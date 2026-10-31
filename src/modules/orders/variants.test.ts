import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { productVariants, upsertVariants } from '@/modules/kiot';
import { createProduct, createSeller, createUser, sampleAddress } from '../../../tests/helpers/factories';
import { addToCart, getCart } from './cart';
import { placeOrder } from './place-order';

async function productWithVariants() {
  const s = await createSeller({ active: true });
  const p = await createProduct(s.kiotId, { name: 'Áo thun', price: 100_000, stock: 0 });
  const r = await upsertVariants(s.user.id, p.id, {
    optionNames: ['Màu', 'Size'],
    variants: [
      { option1: 'Đỏ', option2: 'M', price: 120_000, stock: 1 },
      { option1: 'Xanh', option2: 'L', price: 150_000, compareAtPrice: 200_000, stock: 5 },
    ],
  });
  expect(r).toEqual({ ok: true });
  const [red, blue] = await productVariants(p.id);
  return { s, p, red: red!, blue: blue! };
}

const order = (userId: string) =>
  placeOrder(userId, { address: sampleAddress, notes: {}, saveAddress: false });

describe('biến thể sản phẩm (SPEC-kiot.md V5.6)', () => {
  it('kiểm dữ liệu khi lưu: trùng tổ hợp, thiếu tuỳ chọn 2, quá 50 biến thể', async () => {
    const s = await createSeller({ active: true });
    const p = await createProduct(s.kiotId);
    const base = { option1: 'Đỏ', option2: 'M', price: 50_000, stock: 1 };
    expect(
      await upsertVariants(s.user.id, p.id, { optionNames: ['Màu', 'Size'], variants: [base, base] }),
    ).toEqual({
      ok: false,
      error: 'DUPLICATE',
    });
    expect(
      await upsertVariants(s.user.id, p.id, {
        optionNames: ['Màu', 'Size'],
        variants: [{ ...base, option2: '' }],
      }),
    ).toEqual({ ok: false, error: 'INVALID' });
    const many = Array.from({ length: 51 }, (_, i) => ({ ...base, option1: `M${i}` }));
    expect(await upsertVariants(s.user.id, p.id, { optionNames: ['Màu'], variants: many })).toEqual({
      ok: false,
      error: 'TOO_MANY',
    });
    expect(await upsertVariants((await createUser()).id, p.id, { optionNames: [], variants: [] })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('phải chọn biến thể; giá và tồn kho theo biến thể; đơn chụp lại nhãn; mua A không trừ B', async () => {
    const { p, red, blue } = await productWithVariants();
    const buyer = await createUser();
    expect(await addToCart(buyer.id, p.id, 1)).toEqual({ ok: false, error: 'VARIANT_REQUIRED' });
    expect(await addToCart(buyer.id, p.id, 6, undefined, blue.id)).toEqual({
      ok: false,
      error: 'EXCEEDS_STOCK',
      stock: 5,
    });
    expect(await addToCart(buyer.id, p.id, 2, undefined, blue.id)).toEqual({ ok: true });
    const cart = await getCart(buyer.id);
    expect(cart.groups[0]!.lines[0]).toMatchObject({ price: 150_000, variantLabel: 'Xanh / L', stock: 5 });
    const r = await order(buyer.id);
    if (!r.ok) throw new Error(JSON.stringify(r));
    const item = await db.orderItem.findFirstOrThrow({ where: { order: { checkoutId: r.checkoutId } } });
    expect(item).toMatchObject({ variantId: blue.id, variantLabel: 'Xanh / L', price: 150_000, qty: 2 });
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: blue.id } })).stock).toBe(3);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: red.id } })).stock).toBe(1);
  });

  it('2 người cùng mua biến thể cuối cùng: chỉ 1 người thành công', async () => {
    const { p, red } = await productWithVariants();
    const [a, b] = [await createUser(), await createUser()];
    await addToCart(a.id, p.id, 1, undefined, red.id);
    await addToCart(b.id, p.id, 1, undefined, red.id);
    const results = await Promise.all([order(a.id), order(b.id)]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: red.id } })).stock).toBe(0);
  });
});
