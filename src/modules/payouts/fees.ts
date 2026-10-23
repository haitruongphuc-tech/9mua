// Phí sàn tính trên TIỀN HÀNG (không tính phí ship), theo tỉ lệ đã chụp vào đơn lúc đặt (basis point).
export function platformFee(subtotal: number, rateBp: number): number {
  return Math.round((subtotal * rateBp) / 10_000);
}

export function sellerCredit(order: {
  subtotal: number;
  shippingFee: number;
  total: number;
  platformFeeRate: number;
}) {
  const fee = platformFee(order.subtotal, order.platformFeeRate);
  return { fee, credit: order.total - fee };
}
