import { describe, expect, it } from 'vitest';
import { shippingFeeFor } from './shipping';

describe('phí ship', () => {
  it('phí cố định khi chưa tới ngưỡng miễn phí', () => {
    expect(shippingFeeFor(100_000, { shippingFee: 30_000, freeShippingThreshold: 300_000 })).toBe(30_000);
  });
  it('miễn phí khi tiền hàng đạt ngưỡng', () => {
    expect(shippingFeeFor(300_000, { shippingFee: 30_000, freeShippingThreshold: 300_000 })).toBe(0);
  });
  it('không đặt ngưỡng thì luôn tính phí', () => {
    expect(shippingFeeFor(10_000_000, { shippingFee: 25_000, freeShippingThreshold: null })).toBe(25_000);
  });
});
