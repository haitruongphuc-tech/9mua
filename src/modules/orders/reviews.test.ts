import { describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createPaidOrder, createUser, sampleImage } from '../../../tests/helpers/factories';
import {
  createReview,
  editReview,
  kiotRating,
  productReviews,
  replyReview,
  remindReviews,
  reportReview,
  resolveReviewReports,
} from './reviews';

const DAY = 86_400_000;

async function deliveredOrder() {
  const o = await createPaidOrder();
  await db.order.update({
    where: { id: o.order.id },
    data: { status: 'delivered', deliveredAt: new Date() },
  });
  const item = await db.orderItem.findFirstOrThrow({ where: { orderId: o.order.id } });
  return { ...o, item };
}

describe('đánh giá sản phẩm (SPEC-orders.md V5.1)', () => {
  it('chỉ người mua đơn đã giao, trong 30 ngày, mỗi món 1 lần; cập nhật ratingAvg/ratingCount', async () => {
    const { buyer, item, product, order } = await deliveredOrder();
    const stranger = await createUser();
    expect(await createReview(stranger.id, item.id, { stars: 5 })).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await createReview(buyer.id, item.id, { stars: 6 })).toEqual({ ok: false, error: 'INVALID' });
    expect(await createReview(buyer.id, item.id, { stars: 4, text: 'xem shop.vn' })).toEqual({
      ok: false,
      error: 'HAS_LINK',
    });
    const r = await createReview(buyer.id, item.id, {
      stars: 4,
      text: 'Ngon',
      images: [await sampleImage()],
    });
    expect(r.ok).toBe(true);
    expect(await createReview(buyer.id, item.id, { stars: 5 })).toEqual({ ok: false, error: 'EXISTS' });
    expect(await db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      ratingAvg: 4,
      ratingCount: 1,
    });
    const page = await productReviews(product.id, { withMedia: true });
    expect(page.summary).toMatchObject({ avg: 4, count: 1 });
    expect(page.items[0]?.media).toHaveLength(1);
    expect(page.items[0]?.itemName).toBe(item.name);

    // Sửa 1 lần trong 7 ngày.
    if (!r.ok) throw new Error();
    expect(await editReview(buyer.id, r.reviewId, { stars: 2 })).toEqual({ ok: true });
    expect(await editReview(buyer.id, r.reviewId, { stars: 3 })).toEqual({ ok: false, error: 'EDIT_USED' });
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).ratingAvg).toBe(2);

    // Quá 30 ngày từ khi giao thì không đánh giá được món khác.
    await db.order.update({
      where: { id: order.id },
      data: { deliveredAt: new Date(Date.now() - 31 * DAY) },
    });
    const late = await deliveredOrder();
    await db.order.update({
      where: { id: late.order.id },
      data: { deliveredAt: new Date(Date.now() - 31 * DAY) },
    });
    expect(await createReview(late.buyer.id, late.item.id, { stars: 5 })).toEqual({
      ok: false,
      error: 'EXPIRED',
    });
  });

  it('chủ Kiot trả lời 1 lần; 5 người báo cáo thì tự ẩn; CEO bỏ qua thì hiện lại; sao Kiot từ 3 đánh giá', async () => {
    const first = await deliveredOrder();
    const r = await createReview(first.buyer.id, first.item.id, { stars: 5 });
    if (!r.ok) throw new Error();
    expect(await replyReview(first.buyer.id, r.reviewId, 'Không phải chủ')).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await replyReview(first.seller.user.id, r.reviewId, 'Cảm ơn bạn')).toEqual({ ok: true });
    expect(await replyReview(first.seller.user.id, r.reviewId, 'Lần hai')).toEqual({
      ok: false,
      error: 'EDIT_USED',
    });
    expect(await kiotRating(first.seller.kiotId)).toBeNull();

    for (let i = 0; i < 5; i += 1)
      expect(await reportReview((await createUser()).id, r.reviewId, 'spam')).toBe(true);
    expect((await db.productReview.findUniqueOrThrow({ where: { id: r.reviewId } })).hiddenBy).toBe(
      'reports',
    );
    expect((await productReviews(first.product.id)).summary.count).toBe(0);
    expect(await resolveReviewReports(r.reviewId, 'dismiss')).toBe(true);
    expect((await productReviews(first.product.id)).summary.count).toBe(1);

    // Thêm 2 đánh giá khác cùng Kiot → đủ 3 thì có sao Kiot.
    for (const stars of [3, 4])
      await db.productReview.create({
        data: {
          orderItemId: `thu-${r.reviewId}-${stars}`,
          productId: first.product.id,
          kiotId: first.seller.kiotId,
          buyerId: (await createUser()).id,
          stars,
        },
      });
    expect(await kiotRating(first.seller.kiotId)).toEqual({ avg: 4, count: 3 });
  });

  it('nhắc đánh giá 3 ngày sau khi giao, mỗi đơn một lần', async () => {
    const { buyer, order } = await deliveredOrder();
    await db.order.update({ where: { id: order.id }, data: { deliveredAt: new Date(Date.now() - 4 * DAY) } });
    setClock(new Date());
    try {
      expect(await remindReviews()).toBeGreaterThanOrEqual(1);
      expect(await db.notification.count({ where: { userId: buyer.id } })).toBeGreaterThanOrEqual(1);
      const again = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(again.reviewRemindedAt).not.toBeNull();
    } finally {
      resetClock();
    }
  });
});
