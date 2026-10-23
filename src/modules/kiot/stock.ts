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
