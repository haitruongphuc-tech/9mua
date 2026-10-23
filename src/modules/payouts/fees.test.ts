import { describe, expect, it } from 'vitest';
import { platformFee, sellerCredit } from './fees';

describe('phí sàn', () => {
  it('5% của 99.999đ làm tròn thành 5.000đ', () => {
    expect(platformFee(99_999, 500)).toBe(5_000);
  });
  it('phí sàn tính trên tiền hàng, không tính trên phí ship', () => {
    expect(
      sellerCredit({ subtotal: 100_000, shippingFee: 30_000, total: 130_000, platformFeeRate: 500 }),
    ).toEqual({ fee: 5_000, credit: 125_000 });
  });
  it('tỉ lệ 0% thì người bán nhận đủ', () => {
    expect(sellerCredit({ subtotal: 100_000, shippingFee: 0, total: 100_000, platformFeeRate: 0 })).toEqual({
      fee: 0,
      credit: 100_000,
    });
  });
});
