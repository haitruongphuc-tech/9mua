import type { Tx } from '@/lib/db';

export type StockLine = { productId: string; qty: number };

export class OutOfStockError extends Error {
  constructor(readonly productId: string) {
    super(`Sản phẩm ${productId} không đủ hàng`);
  }
}

// Gọi BÊN TRONG transaction của module orders. Thiếu hàng thì ném OutOfStockError để transaction rollback
// toàn bộ (không trừ dở dang). UPDATE có điều kiện stock >= qty nên hai người mua món cuối cùng lúc
// thì chỉ một người thành công; CHECK (stock >= 0) ở DB là chốt chặn cuối.
export async function decrementStock(tx: Tx, lines: StockLine[]): Promise<void> {
  // Khoá theo thứ tự productId cố định để hai đơn nhiều món không chờ khoá lẫn nhau (deadlock).
  for (const line of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error('Số lượng phải là số nguyên dương');
    const updated = await tx.$executeRaw`
      UPDATE "Product" SET stock = stock - ${line.qty}, "updatedAt" = now()
      WHERE id = ${line.productId} AND "deletedAt" IS NULL AND stock >= ${line.qty}`;
    if (updated !== 1) throw new OutOfStockError(line.productId);
  }
}

export async function restoreStock(tx: Tx, lines: StockLine[]): Promise<void> {
  for (const line of [...lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
    await tx.$executeRaw`UPDATE "Product" SET stock = stock + ${line.qty}, "updatedAt" = now() WHERE id = ${line.productId}`;
  }
}

// Thử giữ hàng mà KHÔNG ném lỗi (dùng khi tiền vào muộn sau khi đơn đã tự huỷ): khoá các dòng sản phẩm,
// kiểm đủ hàng cho mọi món rồi mới trừ; thiếu một món thì không trừ món nào.
export async function tryDecrementStock(tx: Tx, lines: StockLine[]): Promise<boolean> {
  const sorted = [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
  for (const line of sorted) {
    const rows = await tx.$queryRaw<{ stock: number; deleted: boolean }[]>`
      SELECT stock, "deletedAt" IS NOT NULL AS deleted FROM "Product" WHERE id = ${line.productId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.deleted || row.stock < line.qty) return false;
  }
  await decrementStock(tx, sorted);
  return true;
}
