// Phí ship của một đơn (một Kiot): cố định, miễn phí khi tiền hàng đạt ngưỡng (SPEC-orders.md mục 2).
export function shippingFeeFor(
  subtotal: number,
  kiot: { shippingFee: number; freeShippingThreshold: number | null },
): number {
  if (kiot.freeShippingThreshold != null && subtotal >= kiot.freeShippingThreshold) return 0;
  return kiot.shippingFee;
}
