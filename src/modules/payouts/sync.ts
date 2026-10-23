import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { formatVnd } from '@/lib/format';
import { payoutClient } from '@/modules/payments';
import { applyPayoutInfo, sendToPayos } from './dispatch';

export const STUCK_AFTER_HOURS = 2;
export const FUND_BUFFER_VND = 10_000_000;

// Cron mỗi 2 phút (SPEC-payouts.md mục 5): hỏi PayOS trạng thái mọi lệnh đang chuyển.
// Chạy chồng vẫn an toàn: đổi trạng thái có điều kiện, hoàn số dư có khoá duy nhất, gửi lại cùng idempotencyKey.
export async function syncProcessingPayouts(): Promise<{ checked: number; paid: number; failed: number }> {
  const client = payoutClient();
  const result = { checked: 0, paid: 0, failed: 0 };
  if (!client) return result;
  const list = await db.payoutRequest.findMany({
    where: { status: 'processing' },
    orderBy: { dispatchedAt: 'asc' },
    take: 100,
  });
  for (const p of list) {
    result.checked += 1;
    let state = p.payosState;
    try {
      let status;
      if (p.payosPayoutId) {
        const info = await client.get(p.payosPayoutId);
        state = info.state;
        status = await applyPayoutInfo(p.id, info);
      } else {
        const found = await client.findByReference(p.code);
        state = found?.state ?? state;
        status = found ? await applyPayoutInfo(p.id, found) : await sendToPayos(p);
      }
      if (status === 'paid') result.paid += 1;
      if (status === 'failed') result.failed += 1;
      if (status !== 'processing') continue;
    } catch (e) {
      console.error(`[payouts] đồng bộ ${p.code} lỗi:`, e instanceof Error ? e.message : e);
    }
    const age = now().getTime() - (p.dispatchedAt ?? p.createdAt).getTime();
    if (!p.stuckAlertedAt && (state === 'ON_HOLD' || age > STUCK_AFTER_HOURS * 3_600_000)) {
      await db.payoutRequest.update({ where: { id: p.id }, data: { stuckAlertedAt: now() } });
      await alertCeo(
        'payout_stuck',
        `${p.code} (${formatVnd(p.netAmount)}) ${state === 'ON_HOLD' ? 'bị PayOS tạm giữ (ON_HOLD)' : `đang chuyển quá ${STUCK_AFTER_HOURS} giờ`}. Kiểm tra trên trang PayOS.`,
      );
    }
  }
  await checkPayoutFund();
  return result;
}

// Quỹ chi PayOS phải đủ cho mọi yêu cầu đang chờ cộng 10 triệu dự phòng; thiếu thì báo CEO nạp thêm.
export async function checkPayoutFund(): Promise<{ fund: number; open: number } | null> {
  const client = payoutClient();
  if (!client) return null;
  try {
    const [fund, open] = await Promise.all([
      client.balance(),
      db.payoutRequest.aggregate({
        where: { status: { in: ['pending', 'processing'] } },
        _sum: { netAmount: true },
      }),
    ]);
    const need = (open._sum.netAmount ?? 0) + FUND_BUFFER_VND;
    if (fund < need)
      await alertCeo(
        'payout_fund_low',
        `Quỹ chi PayOS còn ${formatVnd(fund)}; yêu cầu đang chờ ${formatVnd(open._sum.netAmount ?? 0)}. Nạp thêm ít nhất ${formatVnd(need - fund)}.`,
      );
    return { fund, open: open._sum.netAmount ?? 0 };
  } catch (e) {
    console.error('[payouts] không đọc được quỹ chi PayOS:', e instanceof Error ? e.message : e);
    return null;
  }
}
