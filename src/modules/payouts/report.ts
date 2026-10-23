import { db } from '@/lib/db';

// Các đơn mà 9MUA đang giữ tiền: chưa hoàn tất (của người bán) hoặc chờ hoàn (của người mua).
const HELD_ORDER_STATUSES = [
  'paid',
  'confirmed',
  'shipping',
  'delivered',
  'disputed',
  'refund_pending',
] as const;

export type CustodyReport = {
  held: number; // tổng tiền đang giữ hộ = sellerBalances + reserved + pendingOrders
  sellerBalances: number; // số dư người bán có thể rút
  reserved: number; // yêu cầu rút chưa chi xong (đã trừ khỏi số dư, tiền vẫn ở 9MUA)
  pendingOrders: number; // đơn đã trả tiền nhưng chưa hoàn tất hoặc chờ hoàn
  platformFees: number; // phí sàn trong khoảng thời gian
  paidOut: number; // đã chuyển tới người bán trong khoảng thời gian (sau phí chi hộ)
  payoutFees: number; // phí chi hộ PayOS của các lệnh đó (người bán chịu)
};

// Báo cáo đối chiếu với số dư thật của TK MB 979393916 (SPEC-payouts.md mục 8).
export async function custodyReport(range: { from: Date; to: Date }): Promise<CustodyReport> {
  const [balances, reserved, pending, fees, paid] = await Promise.all([
    db.balanceEntry.aggregate({ _sum: { amount: true } }),
    db.payoutRequest.aggregate({
      where: { status: { in: ['pending', 'processing'] } },
      _sum: { amount: true },
    }),
    db.order.aggregate({ where: { status: { in: [...HELD_ORDER_STATUSES] } }, _sum: { total: true } }),
    db.platformRevenue.aggregate({
      where: { createdAt: { gte: range.from, lt: range.to } },
      _sum: { fee: true },
    }),
    db.payoutRequest.aggregate({
      where: { status: 'paid', paidAt: { gte: range.from, lt: range.to } },
      _sum: { netAmount: true, fee: true },
    }),
  ]);
  const sellerBalances = balances._sum.amount ?? 0;
  const reservedSum = reserved._sum.amount ?? 0;
  const pendingOrders = pending._sum.total ?? 0;
  return {
    held: sellerBalances + reservedSum + pendingOrders,
    sellerBalances,
    reserved: reservedSum,
    pendingOrders,
    platformFees: fees._sum.fee ?? 0,
    paidOut: paid._sum.netAmount ?? 0,
    payoutFees: paid._sum.fee ?? 0,
  };
}
