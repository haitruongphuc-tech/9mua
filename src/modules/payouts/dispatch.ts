import type { PayoutRequest } from '@prisma/client';
import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { formatVnd } from '@/lib/format';
import { payoutClient, PayoutRejectedError, type PayoutInfo } from '@/modules/payments';
import { capReasons, fundReasons } from './auto-rules';
import { isKycApproved } from './kyc';
import { lockKiotBalance } from './ledger';
import { moveFrom, notifyPaid, notifySeller, reversePayout } from './state';

export type DispatchError =
  'NOT_FOUND' | 'NOT_PENDING' | 'CHANNEL_UNAVAILABLE' | 'KYC_REQUIRED' | 'FUND_LOW' | 'CAP_EXCEEDED';
export type DispatchResult =
  { ok: true; status: PayoutRequest['status'] } | { ok: false; error: DispatchError; message: string };

const fail = (error: DispatchError, message: string): DispatchResult => ({ ok: false, error, message });

// idempotencyKey cố định theo yêu cầu; chỉ đổi khi PayOS đã xác nhận KHÔNG có lệnh nào cho yêu cầu này.
export const idempotencyKey = (p: Pick<PayoutRequest, 'id' | 'payosAttempt'>) =>
  p.payosAttempt === 0 ? p.id : `${p.id}-r${p.payosAttempt}`;

// Chuyển pending → processing rồi gửi lệnh chi PayOS. Dùng cho cả chi tự động lẫn nút "Chi qua PayOS" của CEO
// (CEO bỏ qua luật, nhưng vẫn kiểm KYC và quỹ chi).
export async function dispatchPayout(
  payoutId: string,
  by: { mode: 'auto' } | { mode: 'manual'; adminId: string },
): Promise<DispatchResult> {
  if (!payoutClient()) return fail('CHANNEL_UNAVAILABLE', 'Chưa kết nối kênh chi hộ PayOS');
  const p = await db.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!p) return fail('NOT_FOUND', 'Không tìm thấy yêu cầu rút');
  if (p.status !== 'pending') return fail('NOT_PENDING', 'Yêu cầu không còn chờ duyệt');
  if (!(await isKycApproved(p.requestedById))) return fail('KYC_REQUIRED', 'Người bán chưa được duyệt CCCD');
  const fund = await fundReasons(p);
  if (fund.length) return fail('FUND_LOW', fund[0]!);

  const at = now();
  const moved = await db.$transaction(async (tx) => {
    // Khoá chung: hai lệnh tự động chạy song song không thể cùng lọt qua hạn mức ngày.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payouts:dispatch'))`;
    if (by.mode === 'auto') {
      const caps = await capReasons(p, tx);
      if (caps.length) return caps[0]!;
    }
    return moveFrom(tx, payoutId, 'pending', {
      status: 'processing',
      mode: by.mode,
      dispatchedAt: at,
      ...(by.mode === 'manual' ? { processedById: by.adminId, processedAt: at } : {}),
    });
  });
  if (typeof moved === 'string') return fail('CAP_EXCEEDED', moved);
  if (!moved) return fail('NOT_PENDING', 'Yêu cầu không còn chờ duyệt');
  return { ok: true, status: await sendToPayos(moved) };
}

// Gửi (hoặc gửi lại) lệnh chi cho yêu cầu đang processing. An toàn khi gọi lặp: cùng idempotencyKey.
export async function sendToPayos(p: PayoutRequest): Promise<PayoutRequest['status']> {
  const client = payoutClient();
  if (!client) return 'processing';
  let info: PayoutInfo;
  try {
    info = await client.create(
      {
        referenceId: p.code,
        amount: p.netAmount,
        description: `9MUA RUT ${p.code}`,
        toBin: p.bankBin,
        toAccountNumber: p.accountNumber,
      },
      idempotencyKey(p),
    );
  } catch (e) {
    if (!(e instanceof PayoutRejectedError)) {
      // Không biết PayOS đã nhận lệnh chưa: giữ processing, cron đồng bộ hỏi lại / gửi lại cùng khoá.
      console.error(`[payouts] gửi lệnh ${p.code} chưa rõ kết quả:`, e instanceof Error ? e.message : e);
      await db.payoutRequest.updateMany({
        where: { id: p.id, status: 'processing' },
        data: { payosState: 'UNKNOWN' },
      });
      return 'processing';
    }
    const existing = await client.findByReference(p.code).catch(() => undefined);
    if (existing === undefined) return 'processing'; // không xác minh được → để cron xử lý
    if (!existing) return backToQueue(p, e.message);
    info = existing;
  }
  return applyPayoutInfo(p.id, info);
}

// PayOS từ chối và xác nhận không có lệnh nào: trả về hàng chờ CEO (tiền vẫn giữ trong yêu cầu).
async function backToQueue(p: PayoutRequest, message: string): Promise<'pending'> {
  await db.$transaction((tx) =>
    moveFrom(tx, p.id, 'processing', {
      status: 'pending',
      mode: 'manual',
      payosState: 'REJECTED',
      payosAttempt: { increment: 1 },
      dispatchedAt: null,
      autoRuleReasons: [`PayOS từ chối: ${message}`],
    }),
  );
  await alertCeo('payout_rejected', `${p.code} (${formatVnd(p.netAmount)}): PayOS từ chối — ${message}`);
  return 'pending';
}

const FAILED_STATES = new Set(['FAILED', 'CANCELLED', 'REVERSED']);

// Ghi nhận trạng thái PayOS trả về. Chỉ SUCCEEDED mới thành paid; lỗi thì hoàn số dư cho người bán.
export async function applyPayoutInfo(payoutId: string, info: PayoutInfo): Promise<PayoutRequest['status']> {
  if (info.state === 'SUCCEEDED') {
    const moved = await db.$transaction((tx) =>
      moveFrom(tx, payoutId, 'processing', {
        status: 'paid',
        payosPayoutId: info.id,
        payosState: info.state,
        bankRef: info.bankRef,
        receiverNameFromBank: info.toAccountName,
        paidAt: now(),
      }),
    );
    if (moved) await notifyPaid(payoutId);
    return moved ? 'paid' : currentStatus(payoutId);
  }
  if (FAILED_STATES.has(info.state)) {
    const moved = await db.$transaction(async (tx) => {
      const p = await tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } });
      await lockKiotBalance(tx, p.kiotId);
      const m = await moveFrom(tx, payoutId, 'processing', {
        status: 'failed',
        payosPayoutId: info.id,
        payosState: info.state,
        rejectReason: info.error ?? `PayOS báo ${info.state}`,
      });
      if (m) await reversePayout(tx, m, `Chi lỗi ${m.code}`, null);
      return m;
    });
    if (moved) {
      await notifySeller(payoutId, (p) => ({
        subject: `Chuyển tiền cho yêu cầu rút ${p.code} bị lỗi`,
        lines: [
          `Ngân hàng không nhận lệnh chuyển ${formatVnd(p.netAmount)}${p.rejectReason ? `: ${p.rejectReason}` : ''}.`,
          'Số tiền đã được trả lại vào số dư Kiot. Hãy kiểm tra tài khoản nhận tiền rồi tạo yêu cầu mới.',
        ],
      }));
      await alertCeo(
        'payout_failed',
        `${moved.code} (${formatVnd(moved.netAmount)}): PayOS báo ${info.state}${info.error ? ` — ${info.error}` : ''}. Đã hoàn số dư cho người bán.`,
      );
    }
    return moved ? 'failed' : currentStatus(payoutId);
  }
  await db.payoutRequest.updateMany({
    where: { id: payoutId, status: 'processing' },
    data: { payosPayoutId: info.id, payosState: info.state },
  });
  return currentStatus(payoutId);
}

async function currentStatus(payoutId: string) {
  return (await db.payoutRequest.findUniqueOrThrow({ where: { id: payoutId }, select: { status: true } }))
    .status;
}

export function approvePayoutViaPayos(payoutId: string, adminId: string): Promise<DispatchResult> {
  return dispatchPayout(payoutId, { mode: 'manual', adminId });
}
