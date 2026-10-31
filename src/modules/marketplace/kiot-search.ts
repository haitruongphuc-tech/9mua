import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { kiotOrigin } from '@/lib/urls';
import { distanceSql, provinceCentersSql, provinceName } from '@/modules/kiot';
import { normalizeQuery } from './query';
import { visibleOnMarket } from './search';

// Tìm Kiot theo tên / giới thiệu (SPEC-marketplace.md V5.1), Gần tôi (V5.2). Vị trí người mua chỉ dùng trong lần tìm này:
// không lưu, không ghi log.
export const NEAR_RADII = [1, 3, 5, 10, 20, 50] as const;
export type Near = { lat: number; lng: number; radiusKm: number };

export type KiotSearchCard = {
  slug: string;
  name: string;
  logoUrl: string | null;
  province: string | null;
  products: number;
  priceMin: number | null;
  priceMax: number | null;
  url: string;
  distanceKm: number | null;
  approx: boolean; // Kiot chưa đặt ghim: tính theo tâm tỉnh ("khoảng 12 km")
};

type Row = {
  slug: string;
  name: string;
  logoUrl: string | null;
  province: string | null;
  products: number;
  price_min: number | null;
  price_max: number | null;
  dist: number | null;
  approx: boolean;
};

// Khớp tên Kiot gần đúng (gõ sai nhẹ), giới thiệu khớp nguyên cụm đã bỏ dấu — cùng cách tìm sản phẩm.
function nameMatch(q: string): Prisma.Sql {
  if (q.length < 4) {
    const wordStart = `(^| )${q}`;
    return Prisma.sql`(search_norm(k.name) ~ ${wordStart} OR search_norm(k.description) ~ ${wordStart})`;
  }
  return Prisma.sql`(search_norm(k.name) %> ${q} OR search_norm(k.name) LIKE ${`%${q}%`}
    OR search_norm(k.description) LIKE ${`%${q}%`})`;
}

export async function searchKiots(params: {
  q?: string;
  province?: string;
  area?: string; // phường/xã hoặc địa danh: khớp địa chỉ lấy hàng
  near?: Near;
  limit?: number;
  offset?: number;
}): Promise<{ items: KiotSearchCard[]; nextOffset: number | null }> {
  const limit = params.limit ?? 30;
  const offset = Math.max(0, params.offset ?? 0);
  const at = now();
  const q = params.q ? normalizeQuery(params.q) : '';
  const area = params.area ? normalizeQuery(params.area) : '';
  const near = params.near;
  const filters: Prisma.Sql[] = [Prisma.sql`k."activeUntil" > ${at} AND k."lockedAt" IS NULL`];
  if (q) filters.push(nameMatch(q));
  if (params.province) filters.push(Prisma.sql`k.province = ${params.province}`);
  if (area)
    filters.push(Prisma.sql`search_norm(concat_ws(' ', k."addressLine", k.district)) LIKE ${`%${area}%`}`);
  const dist = near ? distanceSql(near.lat, near.lng) : Prisma.sql`NULL::float8`;
  const order = near
    ? Prisma.sql`dist ASC, orders DESC`
    : q
      ? Prisma.sql`(search_norm(name) LIKE ${`%${q}%`}) DESC, orders DESC`
      : Prisma.sql`orders DESC`;
  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.4`);
    return tx.$queryRaw<Row[]>`
      WITH kiots AS (
        SELECT k.id, k.slug, k.name, k."logoUrl", k.province, k."createdAt", k.lat IS NULL AS approx, ${dist} AS dist,
          (SELECT COUNT(*)::int FROM "Product" p WHERE p."kiotId" = k.id AND ${visibleOnMarket(at)}) AS products,
          (SELECT MIN(p.price)::int FROM "Product" p WHERE p."kiotId" = k.id AND ${visibleOnMarket(at)}) AS price_min,
          (SELECT MAX(p.price)::int FROM "Product" p WHERE p."kiotId" = k.id AND ${visibleOnMarket(at)}) AS price_max,
          (SELECT COUNT(DISTINCT ps."orderId")::int FROM "ProductSale" ps WHERE ps."kiotId" = k.id) AS orders
        FROM "Kiot" k LEFT JOIN ${provinceCentersSql} ON pc.slug = k.province
        WHERE ${Prisma.join(filters, ' AND ')}
      )
      SELECT slug, name, "logoUrl", province, products, price_min, price_max, dist, approx FROM kiots
      WHERE products > 0 ${near ? Prisma.sql`AND dist IS NOT NULL AND dist <= ${near.radiusKm}::float8` : Prisma.empty}
      ORDER BY ${order}, "createdAt" DESC, id
      LIMIT ${limit + 1} OFFSET ${offset}`;
  });
  return {
    items: rows.slice(0, limit).map((r) => ({
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoUrl,
      province: provinceName(r.province),
      products: r.products,
      priceMin: r.price_min,
      priceMax: r.price_max,
      url: kiotOrigin(r.slug),
      distanceKm: r.dist === null ? null : Math.round(r.dist * 10) / 10,
      approx: r.approx,
    })),
    nextOffset: rows.length > limit ? offset + limit : null,
  };
}
