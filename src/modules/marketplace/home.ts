import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { activePinSql, addPin } from '@/lib/pins';
import { kiotOrigin } from '@/lib/urls';
import { categoryName, provinceName } from '@/modules/kiot';
import { hydrate, searchProducts, visibleOnMarket, type MarketCard } from './search';

export type KiotCard = {
  slug: string;
  name: string;
  logoUrl: string | null;
  province: string | null;
  mainCategory: string | null;
  products: number;
  completedOrders: number;
  url: string;
  pinned: boolean; // CEO ghim lên đầu
};

type KiotRow = {
  slug: string;
  name: string;
  logoUrl: string | null;
  province: string | null;
  main_category: string | null;
  products: number;
  orders: number;
  pin_pos: number | null;
};

const toKiotCard = (r: KiotRow): KiotCard => ({
  slug: r.slug,
  name: r.name,
  logoUrl: r.logoUrl,
  province: provinceName(r.province),
  mainCategory: r.main_category ? categoryName(r.main_category) : null,
  products: r.products,
  completedOrders: r.orders,
  url: kiotOrigin(r.slug),
  pinned: r.pin_pos !== null,
});

// Kiot đang hoạt động có ít nhất 1 sản phẩm hiện. orders = số đơn hoàn tất (từ since, nếu có).
function kiotQuery(opts: {
  since?: Date;
  province?: string;
  category?: string;
  limit: number;
  offset?: number;
}): Prisma.Sql {
  const at = now();
  const orderFilter = opts.since ? Prisma.sql`AND ps."completedAt" >= ${opts.since}` : Prisma.empty;
  return Prisma.sql`
    WITH kiots AS (
      SELECT k.id, k.slug, k.name, k."logoUrl", k.province, k."createdAt", ${activePinSql('kiot', 'k')} AS pin_pos,
        (SELECT COUNT(*)::int FROM "Product" p WHERE p."kiotId" = k.id AND ${visibleOnMarket(at)}) AS products,
        (SELECT mode() WITHIN GROUP (ORDER BY p.category) FROM "Product" p
          WHERE p."kiotId" = k.id AND ${visibleOnMarket(at)}) AS main_category,
        (SELECT COUNT(DISTINCT ps."orderId")::int FROM "ProductSale" ps WHERE ps."kiotId" = k.id ${orderFilter}) AS orders
      FROM "Kiot" k
      WHERE k."activeUntil" > ${at} AND k."lockedAt" IS NULL
        ${opts.province ? Prisma.sql`AND k.province = ${opts.province}` : Prisma.empty}
    )
    SELECT slug, name, "logoUrl", province, main_category, products, orders, pin_pos FROM kiots
    WHERE products > 0 ${opts.category ? Prisma.sql`AND main_category = ${opts.category}` : Prisma.empty}
    ORDER BY pin_pos ASC NULLS LAST, orders DESC, "createdAt" DESC, id
    LIMIT ${opts.limit} OFFSET ${opts.offset ?? 0}`;
}

// Danh bạ Kiot /cho/kiot: lọc theo tỉnh và danh mục chính, sắp theo số đơn hoàn tất.
export async function listKiots(params: {
  province?: string;
  category?: string;
  cursor?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 24;
  const offset = Math.max(Number(params.cursor ?? 0) || 0, 0);
  const rows = await db.$queryRaw<KiotRow[]>(kiotQuery({ ...params, limit: limit + 1, offset }));
  return {
    items: rows.slice(0, limit).map(toKiotCard),
    nextCursor: rows.length > limit ? String(offset + limit) : null,
  };
}

export type HomeSections = {
  bestSellers: MarketCard[];
  newest: MarketCard[];
  featuredKiots: KiotCard[];
  featuredLabel: 'top' | 'new';
  stats: { kiots: number; products: number };
};

// Trang chủ (SPEC-marketplace.md mục 1). Mọi con số là số thật từ DB, không có bộ đếm giả.
export async function getHomeSections(): Promise<HomeSections> {
  const at = now();
  const since = new Date(at.getTime() - 30 * 86_400_000);
  const [best, newest, topKiots, stats] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT p.id FROM "Product" p
      JOIN "Kiot" k ON k.id = p."kiotId"
      JOIN "ProductSalesStat" s ON s."productId" = p.id
      WHERE ${visibleOnMarket(at)} AND s."sold30d" > 0 AND p.stock > 0
      ORDER BY s."sold30d" DESC, p."createdAt" DESC LIMIT 10`,
    searchProducts({ sort: 'moi-nhat' }, 10),
    db.$queryRaw<KiotRow[]>(kiotQuery({ since, limit: 8 })),
    db.$queryRaw<{ kiots: number; products: number }[]>`
      SELECT
        (SELECT COUNT(*)::int FROM "Kiot" k WHERE k."activeUntil" > ${at} AND k."lockedAt" IS NULL) AS kiots,
        (SELECT COUNT(*)::int FROM "Product" p JOIN "Kiot" k ON k.id = p."kiotId" WHERE ${visibleOnMarket(at)}) AS products`,
  ]);
  const withSales = topKiots.filter((k) => k.orders > 0 || k.pin_pos !== null);
  return {
    bestSellers: await hydrate(best.map((r) => r.id)),
    newest: newest.items,
    // Chưa có Kiot nào có đơn hoàn tất trong 30 ngày thì hiện Kiot mới mở (ghi rõ nhãn, không giả số).
    featuredKiots: (withSales.length > 0 ? withSales : topKiots).map(toKiotCard),
    featuredLabel: withSales.length > 0 ? 'top' : 'new',
    stats: stats[0] ?? { kiots: 0, products: 0 },
  };
}

// CEO ghim Kiot lên đầu danh bạ / Kiot nổi bật: chỉ Kiot đang hoạt động.
export async function pinKiot(
  slug: string,
  adminId: string,
  until: Date | null,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'FULL' | 'EXISTS' }> {
  const kiot = await db.kiot.findFirst({
    where: { slug: slug.trim().toLowerCase(), activeUntil: { gt: now() }, lockedAt: null },
    select: { id: true },
  });
  if (!kiot) return { ok: false, error: 'NOT_FOUND' };
  return addPin('kiot', kiot.id, adminId, until);
}
