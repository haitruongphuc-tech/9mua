import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createSeller } from '../../../tests/helpers/factories';
import { decrementStock, OutOfStockError, restoreStock } from './stock';

async function product(kiotId: string, stock: number) {
  return db.product.create({ data: { kiotId, name: 'SP', price: 10_000, stock, category: 'khac' } });
}

describe('tồn kho', () => {
  it('20 giao dịch đồng thời trên tồn kho 5: đúng 5 thành công, tồn kho về 0', async () => {
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId, 5);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        db.$transaction((tx) => decrementStock(tx, [{ productId: p.id, qty: 1 }])),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    expect(
      results.filter((r) => r.status === 'rejected' && r.reason instanceof OutOfStockError),
    ).toHaveLength(15);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
  });

  it('nhiều món: thiếu một món thì không trừ món nào (transaction rollback)', async () => {
    const { kiotId } = await createSeller({ active: true });
    const a = await product(kiotId, 5);
    const b = await product(kiotId, 1);
    await expect(
      db.$transaction((tx) =>
        decrementStock(tx, [
          { productId: a.id, qty: 2 },
          { productId: b.id, qty: 2 },
        ]),
      ),
    ).rejects.toMatchObject({ productId: b.id });
    expect((await db.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(5);
    expect((await db.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(1);
  });

  it('không trừ sản phẩm đã xoá; số lượng phải dương', async () => {
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId, 5);
    await db.product.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    await expect(
      db.$transaction((tx) => decrementStock(tx, [{ productId: p.id, qty: 1 }])),
    ).rejects.toBeInstanceOf(OutOfStockError);
    const q = await product(kiotId, 5);
    await expect(
      db.$transaction((tx) => decrementStock(tx, [{ productId: q.id, qty: 0 }])),
    ).rejects.toThrow();
  });

  it('hoàn tồn kho khi huỷ đơn', async () => {
    const { kiotId } = await createSeller({ active: true });
    const p = await product(kiotId, 3);
    await db.$transaction((tx) => decrementStock(tx, [{ productId: p.id, qty: 3 }]));
    await db.$transaction((tx) => restoreStock(tx, [{ productId: p.id, qty: 2 }]));
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(2);
  });
});

describe('tryDecrementStock (giữ lại hàng khi trả muộn)', () => {
  it('đủ hàng mọi món thì trừ hết và trả true; thiếu một món thì không trừ gì và trả false', async () => {
    const { tryDecrementStock } = await import('./stock');
    const { kiotId } = await createSeller({ active: true });
    const a = await product(kiotId, 5);
    const b = await product(kiotId, 1);
    expect(
      await db.$transaction((tx) =>
        tryDecrementStock(tx, [
          { productId: a.id, qty: 2 },
          { productId: b.id, qty: 2 },
        ]),
      ),
    ).toBe(false);
    expect((await db.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(5);
    expect(
      await db.$transaction((tx) =>
        tryDecrementStock(tx, [
          { productId: a.id, qty: 2 },
          { productId: b.id, qty: 1 },
        ]),
      ),
    ).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(3);
    expect((await db.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(0);
  });
});
