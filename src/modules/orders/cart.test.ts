import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { addToCart, getCart, MAX_CART_LINES, removeFromCart, updateCartQty } from './cart';

async function product(
  kiotId: string,
  data: { name?: string; price?: number; stock?: number; visible?: boolean } = {},
) {
  return db.product.create({
    data: {
      kiotId,
      name: data.name ?? 'Thanh long',
      price: data.price ?? 45_000,
      stock: data.stock ?? 10,
      category: 'nong-san',
      visible: data.visible ?? true,
    },
  });
}

describe('giỏ hàng', () => {
  it('thêm món, cộng dồn số lượng, ghi nguồn video', async () => {
    const buyer = await createUser();
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId);
    expect(await addToCart(buyer.id, p.id, 2, 'video_1')).toEqual({ ok: true });
    expect(await addToCart(buyer.id, p.id, 1)).toEqual({ ok: true });
    const row = await db.cartItem.findFirstOrThrow();
    expect(row).toMatchObject({ qty: 3, sourceVideoId: 'video_1' });
  });

  it('không vượt tồn kho; sản phẩm ẩn hoặc Kiot không hoạt động thì không thêm được', async () => {
    const buyer = await createUser();
    const active = await createSeller({ active: true });
    const p = await product(active.kiotId, { stock: 2 });
    expect(await addToCart(buyer.id, p.id, 3)).toEqual({ ok: false, error: 'EXCEEDS_STOCK', stock: 2 });
    const hidden = await product(active.kiotId, { visible: false });
    expect(await addToCart(buyer.id, hidden.id, 1)).toEqual({ ok: false, error: 'UNAVAILABLE' });
    const draft = await createSeller();
    const q = await product(draft.kiotId);
    expect(await addToCart(buyer.id, q.id, 1)).toEqual({ ok: false, error: 'UNAVAILABLE' });
    expect(await addToCart(buyer.id, 'khong-co', 1)).toEqual({ ok: false, error: 'UNAVAILABLE' });
  });

  it('chủ Kiot không tự mua hàng của mình', async () => {
    const { user, kiotId } = await createSeller({ active: true });
    const p = await product(kiotId);
    expect(await addToCart(user.id, p.id, 1)).toEqual({ ok: false, error: 'OWN_PRODUCT' });
  });

  it(`tối đa ${MAX_CART_LINES} dòng`, async () => {
    const buyer = await createUser();
    const { kiotId } = await createSeller({ active: true });
    const items = await Promise.all(
      Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => product(kiotId, { name: `SP ${i}` })),
    );
    for (const p of items.slice(0, MAX_CART_LINES)) await addToCart(buyer.id, p.id, 1);
    expect(await addToCart(buyer.id, items[MAX_CART_LINES]!.id, 1)).toEqual({
      ok: false,
      error: 'CART_FULL',
    });
  });

  it('nhóm theo Kiot, tính phí ship và ngưỡng miễn phí theo từng Kiot', async () => {
    const buyer = await createUser();
    const a = await createSeller({ active: true });
    const b = await createSeller({ active: true });
    await db.kiot.update({
      where: { id: a.kiotId },
      data: { shippingFee: 30_000, freeShippingThreshold: 100_000 },
    });
    await db.kiot.update({ where: { id: b.kiotId }, data: { shippingFee: 20_000 } });
    const pa = await product(a.kiotId, { price: 60_000 });
    const pb = await product(b.kiotId, { price: 15_000 });
    await addToCart(buyer.id, pa.id, 2);
    await addToCart(buyer.id, pb.id, 1);
    const cart = await getCart(buyer.id);
    const ga = cart.groups.find((g) => g.kiot.id === a.kiotId)!;
    const gb = cart.groups.find((g) => g.kiot.id === b.kiotId)!;
    expect(ga).toMatchObject({ subtotal: 120_000, shippingFee: 0, total: 120_000, canCheckout: true });
    expect(gb).toMatchObject({ subtotal: 15_000, shippingFee: 20_000, total: 35_000 });
    expect(cart).toMatchObject({ grandTotal: 155_000, canCheckout: true, lineCount: 2 });
  });

  it('dùng giá hiện tại trong DB (người bán đổi giá sau khi thêm vào giỏ)', async () => {
    const buyer = await createUser();
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId, { price: 45_000 });
    await addToCart(buyer.id, p.id, 1);
    await db.product.update({ where: { id: p.id }, data: { price: 50_000 } });
    expect((await getCart(buyer.id)).groups[0]!.lines[0]!.price).toBe(50_000);
  });

  it('cảnh báo món hết hàng/vượt tồn/ẩn/Kiot ngưng và chặn thanh toán nhóm đó', async () => {
    const buyer = await createUser();
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId, { stock: 5 });
    await addToCart(buyer.id, p.id, 4);
    await db.product.update({ where: { id: p.id }, data: { stock: 2 } });
    let cart = await getCart(buyer.id);
    expect(cart.groups[0]!.lines[0]!.problem).toBe('EXCEEDS_STOCK');
    expect(cart.canCheckout).toBe(false);
    await db.product.update({ where: { id: p.id }, data: { stock: 0 } });
    cart = await getCart(buyer.id);
    expect(cart.groups[0]!.lines[0]!.problem).toBe('OUT_OF_STOCK');
    await db.product.update({ where: { id: p.id }, data: { stock: 5 } });
    await db.kiot.update({ where: { id: kiotId }, data: { activeUntil: new Date(Date.now() - 1000) } });
    cart = await getCart(buyer.id);
    expect(cart.groups[0]!.lines[0]!.problem).toBe('UNAVAILABLE');
  });

  it('sửa số lượng (0 = xoá) và xoá món', async () => {
    const buyer = await createUser();
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId, { stock: 5 });
    await addToCart(buyer.id, p.id, 1);
    expect(await updateCartQty(buyer.id, p.id, 6)).toEqual({ ok: false, error: 'EXCEEDS_STOCK', stock: 5 });
    expect(await updateCartQty(buyer.id, p.id, 5)).toEqual({ ok: true });
    expect(await updateCartQty(buyer.id, p.id, 0)).toEqual({ ok: true });
    expect(await db.cartItem.count()).toBe(0);
    await addToCart(buyer.id, p.id, 1);
    await removeFromCart(buyer.id, p.id);
    expect((await getCart(buyer.id)).lineCount).toBe(0);
  });
});
