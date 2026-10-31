import type { Tx } from '@/lib/db';

// variantId: biến thể sản phẩm (SPEC-kiot.md V5.6) — giữ / trả hàng theo từng biến thể, cùng cách khoá như sản phẩm.
export type StockLine = { productId: string; qty: number; variantId?: string | null };

export class OutOfStockError extends Error {
  constructor(readonly productId: string) {
    super(`Sản phẩm ${productId} không đủ hàng`);
  }
}

// Thứ tự khoá cố định (sản phẩm, rồi biến thể) để hai đơn nhiều món không chờ khoá lẫn nhau (deadlock).
const ordered = (lines: StockLine[]) =>
  [...lines].sort((a, b) =>
    `${a.productId}|${a.variantId ?? ''}`.localeCompare(`${b.productId}|${b.variantId ?? ''}`),
  );

// Gọi BÊN TRONG transaction của module orders. Thiếu hàng thì ném OutOfStockError để transaction rollback
// toàn bộ (không trừ dở dang). UPDATE có điều kiện stock >= qty nên hai người mua món cuối cùng lúc
// thì chỉ một người thành công; CHECK (stock >= 0) ở DB là chốt chặn cuối.
export async function decrementStock(tx: Tx, lines: StockLine[]): Promise<void> {
  for (const line of ordered(lines)) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error('Số lượng phải là số nguyên dương');
    const updated = line.variantId
      ? await tx.$executeRaw`
          UPDATE "ProductVariant" v SET stock = v.stock - ${line.qty}
          FROM "Product" p
          WHERE v.id = ${line.variantId} AND v."productId" = ${line.productId} AND p.id = v."productId"
            AND p."deletedAt" IS NULL AND v.hidden = false AND v.stock >= ${line.qty}`
      : await tx.$executeRaw`
          UPDATE "Product" SET stock = stock - ${line.qty}, "updatedAt" = now()
          WHERE id = ${line.productId} AND "deletedAt" IS NULL AND stock >= ${line.qty}`;
    if (updated !== 1) throw new OutOfStockError(line.productId);
  }
}

export async function restoreStock(tx: Tx, lines: StockLine[]): Promise<void> {
  for (const line of ordered(lines)) {
    if (line.variantId)
      await tx.$executeRaw`UPDATE "ProductVariant" SET stock = stock + ${line.qty} WHERE id = ${line.variantId}`;
    else
      await tx.$executeRaw`UPDATE "Product" SET stock = stock + ${line.qty}, "updatedAt" = now() WHERE id = ${line.productId}`;
  }
}

// Thử giữ hàng mà KHÔNG ném lỗi (dùng khi tiền vào muộn sau khi đơn đã tự huỷ): khoá các dòng sản phẩm,
// kiểm đủ hàng cho mọi món rồi mới trừ; thiếu một món thì không trừ món nào.
export async function tryDecrementStock(tx: Tx, lines: StockLine[]): Promise<boolean> {
  const sorted = ordered(lines);
  for (const line of sorted) {
    const rows = line.variantId
      ? await tx.$queryRaw<{ stock: number; deleted: boolean }[]>`
          SELECT v.stock, (p."deletedAt" IS NOT NULL OR v.hidden) AS deleted
          FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
          WHERE v.id = ${line.variantId} FOR UPDATE OF v`
      : await tx.$queryRaw<{ stock: number; deleted: boolean }[]>`
          SELECT stock, "deletedAt" IS NOT NULL AS deleted FROM "Product" WHERE id = ${line.productId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.deleted || row.stock < line.qty) return false;
  }
  await decrementStock(tx, sorted);
  return true;
}
