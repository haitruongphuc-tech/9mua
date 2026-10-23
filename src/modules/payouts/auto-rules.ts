import type { PayoutRequest } from '@prisma/client';
import { now, startOfVnDay } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { formatVnd } from '@/lib/format';
import { getIntSetting, getSetting } from '@/lib/settings';
import { getPayoutAccount } from '@/modules/kiot';
import { payoutClient } from '@/modules/payments';

export const AUTO_ACCOUNT_STABLE_HOURS = 72;

// Tổng đã chi tự động trong ngày (giờ VN), tính cả lệnh đang chuyển; không tính yêu cầu đang xét.
export async function autoPaidToday(
  filter: { kiotId?: string; excludeId?: string } = {},
  tx: Tx | typeof db = db,
) {
  const r = await tx.payoutRequest.aggregate({
    where: {
      mode: 'auto',
      status: { in: ['processing', 'paid'] },
      dispatchedAt: { gte: startOfVnDay() },
      ...(filter.kiotId ? { kiotId: filter.kiotId } : {}),
      ...(filter.excludeId ? { id: { not: filter.excludeId } } : {}),
    },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

export async function capReasons(p: PayoutRequest, tx: Tx | typeof db = db): Promise<string[]> {
  const [perKiotDay, dailyCap] = await Promise.all([
    getIntSetting('payout_auto_max_per_kiot_day', tx),
    getIntSetting('payout_auto_daily_cap', tx),
  ]);
  const reasons: string[] = [];
  if ((await autoPaidToday({ kiotId: p.kiotId, excludeId: p.id }, tx)) + p.amount > perKiotDay)
    reasons.push(`Vượt hạn mức ${formatVnd(perKiotDay)}/ngày của Kiot`);
  if ((await autoPaidToday({ excludeId: p.id }, tx)) + p.amount > dailyCap)
    reasons.push(`Vượt hạn mức ${formatVnd(dailyCap)}/ngày toàn sàn`);
  return reasons;
}

// Luật duyệt tự động (SPEC-payouts.md mục 5). Trả về MỌI lý do không đạt để CEO thấy rõ trong hàng chờ.
export async function evaluateAutoRules(payoutId: string): Promise<{ eligible: boolean; reasons: string[] }> {
  const p = await db.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } });
  const reasons: string[] = [];

  if ((await getSetting('payout_auto_enabled')) !== 'true') reasons.push('CEO đang tắt chi tự động');

  const kyc = await db.kycSubmission.findFirst({
    where: { userId: p.requestedById, status: 'approved' },
    orderBy: { createdAt: 'desc' },
  });
  if (!kyc) reasons.push('Chưa xác minh CCCD');
  else if (kyc.fullName !== p.accountName) reasons.push('Tên tài khoản ngân hàng khác tên trên CCCD');

  const account = await getPayoutAccount(p.kiotId);
  const hours = account ? Math.floor((now().getTime() - account.changedAt.getTime()) / 3_600_000) : 0;
  if (!account || hours < AUTO_ACCOUNT_STABLE_HOURS) reasons.push(`Tài khoản đổi ${hours} giờ trước`);
  else if (account.bankBin !== p.bankBin || account.accountNumber !== p.accountNumber)
    reasons.push('Tài khoản nhận đã đổi sau khi tạo yêu cầu');

  const approvedBefore = await db.payoutRequest.count({
    where: { kiotId: p.kiotId, mode: 'manual', status: 'paid', id: { not: p.id } },
  });
  if (approvedBefore === 0) reasons.push('Lần rút đầu');

  const perRequest = await getIntSetting('payout_auto_max_per_request');
  if (p.amount > perRequest) reasons.push(`Vượt ${formatVnd(perRequest)}`);
  reasons.push(...(await capReasons(p)));

  const kiot = await db.kiot.findUniqueOrThrow({ where: { id: p.kiotId }, select: { lockedAt: true } });
  if (kiot.lockedAt) reasons.push('Kiot đang bị khoá');
  if (await db.order.count({ where: { kiotId: p.kiotId, status: 'disputed' } }))
    reasons.push('Kiot có đơn đang khiếu nại');

  reasons.push(...(await fundReasons(p)));
  return { eligible: reasons.length === 0, reasons };
}

// Quỹ chi PayOS phải đủ cho lệnh này cộng các lệnh khác đang chuyển.
export async function fundReasons(p: Pick<PayoutRequest, 'id' | 'netAmount'>): Promise<string[]> {
  const client = payoutClient();
  if (!client) return ['Chưa kết nối kênh chi hộ PayOS'];
  try {
    const [fund, inFlight] = await Promise.all([
      client.balance(),
      db.payoutRequest.aggregate({
        where: { status: 'processing', id: { not: p.id } },
        _sum: { netAmount: true },
      }),
    ]);
    if (fund < p.netAmount + (inFlight._sum.netAmount ?? 0)) return ['Quỹ chi PayOS không đủ'];
    return [];
  } catch {
    return ['Không kiểm được quỹ chi PayOS'];
  }
}
