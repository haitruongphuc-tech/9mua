import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import type { CompletedOrder } from '@/modules/orders';

// Hook "đơn hoàn tất" (SPEC-marketplace.md): chạy trong transaction của orders.
// Khoá (orderId, productId) + ON CONFLICT DO NOTHING nên chạy lại cũng không cộng 2 lần.
export async function recordSale(tx: Tx, order: CompletedOrder): Promise<void> {
  const at = order.completedAt ?? now();
  const inserted = await tx.$queryRaw<{ productId: string; qty: number }[]>`
    INSERT INTO "ProductSale" ("orderId", "productId", "kiotId", qty, "completedAt")
    SELECT ${order.id}, "productId", ${order.kiotId}, SUM(qty)::int, ${at}
    FROM "OrderItem" WHERE "orderId" = ${order.id}
    GROUP BY "productId"
    ON CONFLICT ("orderId", "productId") DO NOTHING
    RETURNING "productId", qty`;
  for (const row of inserted) {
    await tx.$executeRaw`
      INSERT INTO "ProductSalesStat" ("productId", "sold30d", "soldTotal", "updatedAt")
      VALUES (${row.productId}, ${row.qty}, ${row.qty}, ${now()})
      ON CONFLICT ("productId") DO UPDATE SET
        "sold30d" = "ProductSalesStat"."sold30d" + EXCLUDED."sold30d",
        "soldTotal" = "ProductSalesStat"."soldTotal" + EXCLUDED."soldTotal",
        "updatedAt" = EXCLUDED."updatedAt"`;
  }
}

// Cron hằng đêm: tính lại "đã bán 30 ngày" từ sổ ProductSale (con số cộng dồn trong ngày có thể cũ dần).
export async function refreshSales30d(): Promise<{ updated: number }> {
  const since = new Date(now().getTime() - 30 * 86_400_000);
  const updated = await db.$executeRaw`
    UPDATE "ProductSalesStat" s SET "updatedAt" = ${now()}, "sold30d" = COALESCE((
      SELECT SUM(ps.qty) FROM "ProductSale" ps
      WHERE ps."productId" = s."productId" AND ps."completedAt" >= ${since}
    ), 0)::int`;
  return { updated };
}

// Ô "Đã bán" của trang Kiot V4: tổng số món trong các đơn hoàn tất của Kiot (đếm từ sổ ProductSale).
export async function kiotSoldTotal(kiotId: string): Promise<number> {
  const agg = await db.productSale.aggregate({ where: { kiotId }, _sum: { qty: true } });
  return agg._sum.qty ?? 0;
}
