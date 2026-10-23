import { randomUUID } from 'node:crypto';
import type { PayoutRequest, Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { getIntSetting } from '@/lib/settings';
import { findBank, getPayoutAccount } from '@/modules/kiot';
import { isKycApproved } from './kyc';
import { availableBalance, lockKiotBalance } from './ledger';
import { buildVietQr } from './vietqr';

export const ACCOUNT_HOLD_HOURS = 24;

export type RequestPayoutError =
  | 'NOT_FOUND'
  | 'KYC_REQUIRED'
  | 'BELOW_MIN'
  | 'INSUFFICIENT'
  | 'HAS_PENDING'
  | 'NO_ACCOUNT'
  | 'ACCOUNT_RECENTLY_CHANGED';

export type RequestPayoutResult =
  | { ok: true; payoutId: string; code: string; mode: 'auto' | 'manual'; reasons: string[] }
  | { ok: false; error: RequestPayoutError };

export type PayoutActionResult =
  | { ok: true }
  | {
      ok: false;
      error: 'NOT_FOUND' | 'NOT_CANCELLABLE' | 'NOT_PENDING' | 'REASON_REQUIRED' | 'BANK_REF_REQUIRED';
    };

export async function payoutQuote(amount: number): Promise<{ fee: number; net: number; min: number }> {
  const [fee, min] = await Promise.all([getIntSetting('payout_fee_vnd'), getIntSetting('payout_min_vnd')]);
  return { fee, net: amount - fee, min };
}

// Tạo yêu cầu rút (SPEC-payouts.md mục 4). Số dư trừ ngay bằng dòng payout_reserve trong cùng transaction.
export async function requestPayout(
  kiotId: string,
  userId: string,
  amount: number,
): Promise<RequestPayoutResult> {
  const kiot = await db.kiot.findUnique({ where: { id: kiotId }, select: { ownerId: true } });
  if (!kiot || kiot.ownerId !== userId) return { ok: false, error: 'NOT_FOUND' };
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: 'BELOW_MIN' };
  if (!(await isKycApproved(userId))) return { ok: false, error: 'KYC_REQUIRED' };
  const account = await getPayoutAccount(kiotId);
  if (!account) return { ok: false, error: 'NO_ACCOUNT' };
  if (now().getTime() - account.changedAt.getTime() < ACCOUNT_HOLD_HOURS * 3_600_000)
    return { ok: false, error: 'ACCOUNT_RECENTLY_CHANGED' };

  return db.$transaction(async (tx): Promise<RequestPayoutResult> => {
    await lockKiotBalance(tx, kiotId);
    const [min, fee] = await Promise.all([
      getIntSetting('payout_min_vnd', tx),
      getIntSetting('payout_fee_vnd', tx),
    ]);
    if (amount < min || amount - fee <= 0) return { ok: false, error: 'BELOW_MIN' };
    const open = await tx.payoutRequest.count({
      where: { kiotId, status: { in: ['pending', 'processing'] } },
    });
    if (open > 0) return { ok: false, error: 'HAS_PENDING' };
    if (amount > (await availableBalance(kiotId, tx))) return { ok: false, error: 'INSUFFICIENT' };

    const [seq] = await tx.$queryRaw<{ code: string }[]>`SELECT 'RT' || nextval('payout_code_seq') AS code`;
    const at = now();
    const payout = await tx.payoutRequest.create({
      data: {
        code: seq!.code,
        kiotId,
        requestedById: userId,
        amount,
        fee,
        netAmount: amount - fee,
        bankBin: account.bankBin,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        mode: 'manual',
        createdAt: at,
      },
    });
    await tx.balanceEntry.create({
      data: {
        kiotId,
        type: 'payout_reserve',
        amount: -amount,
        refId: payout.id,
        note: `Rút ${payout.code}`,
        actorId: userId,
        createdAt: at,
      },
    });
    return { ok: true, payoutId: payout.id, code: payout.code, mode: 'manual', reasons: [] };
  });
}

// Trả số dư cho yêu cầu không chi (huỷ, từ chối, PayOS báo lỗi). Khoá duy nhất (type, refId) chặn hoàn 2 lần.
export async function reversePayout(tx: Tx, payout: PayoutRequest, note: string, actorId: string | null) {
  await tx.$executeRaw`
    INSERT INTO "BalanceEntry" (id, "kiotId", type, amount, "refId", note, "actorId", "createdAt")
    VALUES (${randomUUID()}, ${payout.kiotId}, 'payout_reversal', ${payout.amount}, ${payout.id}, ${note},
      ${actorId}, ${now()})
    ON CONFLICT (type, "refId") DO NOTHING`;
}

// Đổi trạng thái có điều kiện: chỉ một luồng thắng khi nhiều thao tác cùng nhắm vào một yêu cầu.
async function moveFrom(
  tx: Tx,
  payoutId: string,
  from: 'pending' | 'processing',
  data: Prisma.PayoutRequestUncheckedUpdateManyInput,
): Promise<PayoutRequest | null> {
  const moved = await tx.payoutRequest.updateMany({ where: { id: payoutId, status: from }, data });
  return moved.count === 1 ? tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } }) : null;
}

export async function cancelPayout(payoutId: string, userId: string): Promise<PayoutActionResult> {
  const payout = await db.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout || payout.requestedById !== userId) return { ok: false, error: 'NOT_FOUND' };
  return db.$transaction(async (tx): Promise<PayoutActionResult> => {
    await lockKiotBalance(tx, payout.kiotId);
    const moved = await moveFrom(tx, payoutId, 'pending', { status: 'cancelled', processedAt: now() });
    if (!moved) return { ok: false, error: 'NOT_CANCELLABLE' };
    await reversePayout(tx, moved, `Huỷ ${moved.code}`, userId);
    return { ok: true };
  });
}

export async function rejectPayout(
  payoutId: string,
  adminId: string,
  reason: string,
): Promise<PayoutActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: 'REASON_REQUIRED' };
  const payout = await db.payoutRequest.findUnique({ where: { id: payoutId } });
  if (!payout) return { ok: false, error: 'NOT_FOUND' };
  const result = await db.$transaction(async (tx): Promise<PayoutActionResult> => {
    await lockKiotBalance(tx, payout.kiotId);
    const moved = await moveFrom(tx, payoutId, 'pending', {
      status: 'rejected',
      rejectReason: trimmed,
      processedById: adminId,
      processedAt: now(),
    });
    if (!moved) return { ok: false, error: 'NOT_PENDING' };
    await reversePayout(tx, moved, `Từ chối ${moved.code}`, adminId);
    return { ok: true };
  });
  if (result.ok)
    await notifySeller(payoutId, (p) => ({
      subject: `Yêu cầu rút ${p.code} bị từ chối`,
      lines: [
        `9MUA từ chối yêu cầu rút ${formatVnd(p.amount)}: ${trimmed}.`,
        'Số tiền đã được trả lại vào số dư Kiot của bạn.',
      ],
    }));
  return result;
}

// "Đã chuyển tay" — dự phòng khi PayOS lỗi: CEO chuyển bằng QR rồi nhập mã giao dịch ngân hàng.
export async function markPayoutPaid(
  payoutId: string,
  adminId: string,
  bankRef: string,
): Promise<PayoutActionResult> {
  const ref = bankRef.trim();
  if (!ref) return { ok: false, error: 'BANK_REF_REQUIRED' };
  const at = now();
  const moved = await db.$transaction((tx) =>
    moveFrom(tx, payoutId, 'pending', {
      status: 'paid',
      mode: 'manual',
      bankRef: ref.slice(0, 64),
      processedById: adminId,
      processedAt: at,
      paidAt: at,
    }),
  );
  if (!moved) {
    const exists = await db.payoutRequest.count({ where: { id: payoutId } });
    return { ok: false, error: exists ? 'NOT_PENDING' : 'NOT_FOUND' };
  }
  await notifyPaid(payoutId);
  return { ok: true };
}

export async function notifyPaid(payoutId: string): Promise<void> {
  await notifySeller(payoutId, (p) => ({
    subject: `Đã chuyển ${formatVnd(p.netAmount)} cho yêu cầu rút ${p.code}`,
    lines: [
      `9MUA đã chuyển ${formatVnd(p.netAmount)} vào tài khoản ${findBank(p.bankBin)?.shortName ?? p.bankBin} ${p.accountNumber}.`,
      p.fee > 0 ? `Phí chi hộ ${formatVnd(p.fee)} đã trừ vào số tiền rút ${formatVnd(p.amount)}.` : '',
      p.bankRef ? `Mã giao dịch: ${p.bankRef}.` : '',
    ].filter(Boolean),
  }));
}

export async function notifySeller(
  payoutId: string,
  build: (p: PayoutRequest) => { subject: string; lines: string[] },
): Promise<void> {
  try {
    const payout = await db.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } });
    const seller = await db.user.findUniqueOrThrow({ where: { id: payout.requestedById } });
    if (!seller.email) return;
    const { subject, lines } = build(payout);
    await sendMail({
      to: seller.email,
      subject,
      ...renderEmail({
        title: subject,
        greeting: `Chào ${seller.displayName},`,
        paragraphs: lines,
        action: { label: 'Xem số dư', url: `${env().APP_URL}/kiot-cua-toi/so-du` },
      }),
    });
  } catch (e) {
    // Thông báo hỏng không được làm hỏng thao tác tiền đã commit.
    console.error('[payouts] gửi email lỗi:', e);
  }
}

export async function listPayoutsForKiot(kiotId: string, take = 50) {
  return db.payoutRequest.findMany({ where: { kiotId }, orderBy: { createdAt: 'desc' }, take });
}

// QR VietQR cho CEO chuyển tay: đúng tài khoản đã chụp lúc tạo, số tiền sau phí, nội dung "9MUA RUT <mã>".
export function manualTransferQr(p: Pick<PayoutRequest, 'bankBin' | 'accountNumber' | 'netAmount' | 'code'>) {
  return buildVietQr({
    bin: p.bankBin,
    accountNumber: p.accountNumber,
    amount: p.netAmount,
    description: `9MUA RUT ${p.code}`,
  });
}
