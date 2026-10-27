import { describe, expect, it } from 'vitest';
import '@/server/payments';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { setSetting } from '@/lib/settings';
import { changeEmail } from '@/modules/identity';
import { getPayment } from '@/server/payments';
import { createProduct, createSeller, createUser, sampleAddress } from '../../../tests/helpers/factories';
import { simulatePaid } from '../../../tests/helpers/payments';
import { addToCart } from './cart';
import { cancelCheckout, expireUnpaidOrders, placeOrder } from './place-order';

async function buyerWithCart(lines: { kiotId: string; price?: number; stock?: number; qty: number }[]) {
  const buyer = await createUser();
  const products = [];
  for (const l of lines) {
    const p = await createProduct(l.kiotId, { price: l.price, stock: l.stock });
    await addToCart(buyer.id, p.id, l.qty);
    products.push(p);
  }
  return { buyer, products };
}

describe('đặt hàng', () => {
  it('giỏ 2 Kiot → 1 checkout, 2 đơn, 1 QR tổng tiền; trừ tồn kho; chụp giá và tỉ lệ phí sàn; xoá giỏ', async () => {
    const a = await createSeller({ active: true });
    const b = await createSeller({ active: true });
    await db.kiot.update({ where: { id: a.kiotId }, data: { shippingFee: 20_000 } });
    const { buyer, products } = await buyerWithCart([
      { kiotId: a.kiotId, price: 45_000, stock: 5, qty: 2 },
      { kiotId: b.kiotId, price: 30_000, stock: 5, qty: 1 },
    ]);
    const r = await placeOrder(buyer.id, {
      address: sampleAddress,
      notes: { [a.kiotId]: 'Giao giờ hành chính' },
      saveAddress: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const orders = await db.order.findMany({
      where: { checkoutId: r.checkoutId },
      include: { items: true, events: true },
      orderBy: { total: 'desc' },
    });
    expect(orders).toHaveLength(2);
    expect(orders[0]).toMatchObject({
      kiotId: a.kiotId,
      subtotal: 90_000,
      shippingFee: 20_000,
      total: 110_000,
      platformFeeRate: 500,
      status: 'pending_payment',
      note: 'Giao giờ hành chính',
    });
    expect(orders[0]!.code).toMatch(/^DH\d{6,}$/);
    expect(orders[0]!.items[0]).toMatchObject({
      name: 'Thanh long ruột đỏ',
      price: 45_000,
      qty: 2,
      imageUrl: '/uploads/p-400.webp',
    });
    expect(orders[0]!.events[0]).toMatchObject({
      from: null,
      to: 'pending_payment',
      action: 'place',
      actorRole: 'buyer',
    });
    expect(orders[0]!.shipTo).toMatchObject({ name: 'Trần Thị Mua', phone: '+84912345678' });

    const intent = await getPayment(r.intentId);
    expect(intent).toMatchObject({
      amount: 140_000,
      purpose: 'order',
      refId: r.checkoutId,
      description: expect.stringMatching(/^DH\d+$/),
    });
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0]!.id } })).stock).toBe(3);
    expect(await db.cartItem.count({ where: { userId: buyer.id } })).toBe(0);
    expect(await db.buyerAddress.findUnique({ where: { userId: buyer.id } })).toMatchObject({
      line: '115 Nguyễn Hậu',
    });
  });

  it('dùng giá trong DB lúc đặt; tỉ lệ phí sàn lấy theo cài đặt hiện hành', async () => {
    const a = await createSeller({ active: true });
    const { buyer, products } = await buyerWithCart([{ kiotId: a.kiotId, price: 45_000, qty: 1 }]);
    await db.product.update({ where: { id: products[0]!.id }, data: { price: 50_000 } });
    await setSetting('platform_fee_bp', '300', null);
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!r.ok) throw new Error(JSON.stringify(r));
    const order = await db.order.findFirstOrThrow({
      where: { checkoutId: r.checkoutId },
      include: { items: true },
    });
    expect(order.items[0]!.price).toBe(50_000);
    expect(order.platformFeeRate).toBe(300);
  });

  it('2 người cùng đặt món cuối cùng: 1 người được, 1 người nhận OUT_OF_STOCK, không ai bị tạo đơn dở', async () => {
    const a = await createSeller({ active: true });
    const p = await createProduct(a.kiotId, { stock: 1 });
    const [u1, u2] = [await createUser(), await createUser()];
    await addToCart(u1.id, p.id, 1);
    await addToCart(u2.id, p.id, 1);
    const results = await Promise.all(
      [u1, u2].map((u) => placeOrder(u.id, { address: sampleAddress, notes: {}, saveAddress: false })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, error: 'OUT_OF_STOCK', productIds: [p.id] });
    expect(await db.order.count()).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
  });

  it('giỏ trống, giỏ có món lỗi, địa chỉ sai đều bị từ chối và không tạo gì', async () => {
    const a = await createSeller({ active: true });
    const empty = await createUser();
    expect(await placeOrder(empty.id, { address: sampleAddress, notes: {}, saveAddress: false })).toEqual({
      ok: false,
      error: 'EMPTY_CART',
    });
    const { buyer } = await buyerWithCart([{ kiotId: a.kiotId, qty: 1 }]);
    expect(
      await placeOrder(buyer.id, {
        address: { ...sampleAddress, phone: '123', line: '' },
        notes: {},
        saveAddress: false,
      }),
    ).toMatchObject({
      ok: false,
      error: 'INVALID_ADDRESS',
      fields: { phone: expect.any(String), line: expect.any(String) },
    });
    await db.kiot.update({ where: { id: a.kiotId }, data: { activeUntil: new Date(Date.now() - 1000) } });
    expect(
      await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false }),
    ).toMatchObject({ ok: false, error: 'CART_INVALID' });
    expect(await db.order.count()).toBe(0);
  });
});

describe('khi tiền vào', () => {
  it('mọi đơn của checkout thành paid; email cho người mua và từng người bán', async () => {
    const a = await createSeller({ active: true });
    const b = await createSeller({ active: true });
    await changeEmail(a.user.id, { email: 'ban-a@9mua.com', password: a.user.password });
    const { buyer } = await buyerWithCart([
      { kiotId: a.kiotId, qty: 1 },
      { kiotId: b.kiotId, qty: 1 },
    ]);
    await changeEmail(buyer.id, { email: 'mua@9mua.com', password: buyer.password });
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!r.ok) throw new Error();
    await simulatePaid((await getPayment(r.intentId))!.orderCode);
    const orders = await db.order.findMany({ where: { checkoutId: r.checkoutId } });
    expect(orders.every((o) => o.status === 'paid' && o.paidAt)).toBe(true);
    expect((await db.checkout.findUniqueOrThrow({ where: { id: r.checkoutId } })).status).toBe('paid');
    expect(getOutbox().some((m) => m.to === 'mua@9mua.com' && m.subject.includes('thanh toán'))).toBe(true);
    expect(getOutbox().some((m) => m.to === 'ban-a@9mua.com' && m.subject.includes('đơn mới'))).toBe(true);
  });

  it('quá 15 phút chưa trả: huỷ và hoàn tồn kho; trả muộn còn hàng → paid', async () => {
    setClock(new Date('2026-10-23T03:00:00Z'));
    const a = await createSeller({ active: true });
    const { buyer, products } = await buyerWithCart([{ kiotId: a.kiotId, stock: 3, qty: 2 }]);
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!r.ok) throw new Error();
    advanceClock({ minutes: 16 });
    expect(await expireUnpaidOrders()).toEqual({ expired: 1 });
    expect(await expireUnpaidOrders()).toEqual({ expired: 0 });
    expect((await db.order.findFirstOrThrow()).status).toBe('cancelled');
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0]!.id } })).stock).toBe(3);

    await simulatePaid((await getPayment(r.intentId))!.orderCode);
    expect((await db.order.findFirstOrThrow()).status).toBe('paid');
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0]!.id } })).stock).toBe(1);
  });

  it('trả muộn khi đã hết hàng → refund_pending, không trừ kho âm', async () => {
    setClock(new Date('2026-10-23T03:00:00Z'));
    const a = await createSeller({ active: true });
    const { buyer, products } = await buyerWithCart([{ kiotId: a.kiotId, stock: 1, qty: 1 }]);
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!r.ok) throw new Error();
    advanceClock({ minutes: 16 });
    await expireUnpaidOrders();
    await db.product.update({ where: { id: products[0]!.id }, data: { stock: 0 } });
    await simulatePaid((await getPayment(r.intentId))!.orderCode);
    const order = await db.order.findFirstOrThrow({ include: { events: { orderBy: { createdAt: 'asc' } } } });
    expect(order.status).toBe('refund_pending');
    expect(order.events.at(-1)).toMatchObject({ action: 'late_pay_no_stock', actorRole: 'system' });
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0]!.id } })).stock).toBe(0);
  });

  it('người mua huỷ trước khi trả: huỷ mọi đơn của checkout, hoàn kho, huỷ QR; người khác không huỷ được', async () => {
    const a = await createSeller({ active: true });
    const { buyer, products } = await buyerWithCart([{ kiotId: a.kiotId, stock: 3, qty: 2 }]);
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!r.ok) throw new Error();
    const stranger = await createUser();
    expect(await cancelCheckout(stranger.id, r.checkoutId)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(await cancelCheckout(buyer.id, r.checkoutId)).toEqual({ ok: true });
    expect((await db.order.findFirstOrThrow()).status).toBe('cancelled');
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0]!.id } })).stock).toBe(3);
    expect((await getPayment(r.intentId))?.status).toBe('cancelled');
  });
});

describe('nguồn buổi live (SPEC-live.md mục 7)', () => {
  it('thêm vào giỏ từ live thì món trong đơn có sourceLiveId', async () => {
    const seller = await createSeller({ active: true });
    const p = await createProduct(seller.kiotId, { price: 50_000, stock: 5 });
    const buyer = await createUser();
    expect(await addToCart(buyer.id, p.id, 1, { liveId: 'live_1' })).toEqual({ ok: true });
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    expect(r.ok).toBe(true);
    const item = await db.orderItem.findFirstOrThrow({ where: { productId: p.id } });
    expect(item).toMatchObject({ sourceLiveId: 'live_1', sourceVideoId: null });
  });
});
