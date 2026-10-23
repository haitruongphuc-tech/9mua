import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { kiotOrigin } from '@/lib/urls';
import { productPath, provinceName, type Page } from '@/modules/kiot';
import { normalizeQuery, type SearchParams, type Sort } from './query';

export type MarketCard = {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  thumbUrl: string | null;
  url: string; // trang sản phẩm trên <slug>.9mua.com
  kiotName: string;
  kiotSlug: string;
  province: string | null;
  sold: number;
};

export const PAGE_SIZE = 24;
// Độ giống tối thiểu khi so từ khoá với một đoạn trong tên/mô tả (chấp nhận gõ sai nhẹ).
const WORD_SIMILARITY = 0.4;

// Mỗi khoá sắp xếp đổi về dạng TĂNG DẦN để phân trang con trỏ bằng so sánh bộ (k1, k2, k3, id):
// k1 = hết hàng xếp cuối, k2 = khoá chính theo kiểu sắp xếp, k3 = mới hơn trước.
function sortKey(sort: Sort): Prisma.Sql {
  switch (sort) {
    case 'phu-hop':
      return Prisma.sql`-(p.score)`;
    case 'ban-chay':
      return Prisma.sql`-(COALESCE(p."sold30d", 0))::float8`;
    case 'gia-tang':
      return Prisma.sql`p.price::float8`;
    case 'gia-giam':
      return Prisma.sql`-(p.price)::float8`;
    case 'moi-nhat':
      return Prisma.sql`0::float8`;
  }
}

// Tên: khớp gần đúng (gõ sai nhẹ vẫn ra). Mô tả: chỉ khớp nguyên cụm đã bỏ dấu, vì mô tả dài nên khớp gần
// đúng sẽ kéo theo rất nhiều kết quả nhiễu. Từ khoá ngắn (< 4 ký tự) chỉ khớp đầu từ: "ao" ra "áo thun"
// nhưng không ra "giao hàng".
function matchClause(q: string): Prisma.Sql {
  if (q.length < 4) {
    const wordStart = `(^| )${q}`;
    return Prisma.sql`(p."searchName" ~ ${wordStart} OR search_norm(p.description) ~ ${wordStart})`;
  }
  return Prisma.sql`(p."searchName" %> ${q} OR p."searchName" LIKE ${`%${q}%`}
    OR search_norm(p.description) LIKE ${`%${q}%`})`;
}

type Cursor = [number, number, number, string];

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (
      Array.isArray(c) &&
      c.length === 4 &&
      c.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n)) &&
      typeof c[3] === 'string'
    )
      return c as Cursor;
  } catch {}
  return null;
}

// Chỉ sản phẩm đang hiện của Kiot đang hoạt động và không bị khoá (SPEC-marketplace.md mục 4).
// Chợ chỉ ĐỌC bảng của kiot; điều kiện ở đây phải giống PUBLIC_PRODUCT_WHERE + isKiotActive.
export async function searchProducts(params: SearchParams, limit = PAGE_SIZE): Promise<Page<MarketCard>> {
  const q = params.q ? normalizeQuery(params.q) : '';
  const sort: Sort = params.sort === 'phu-hop' && !q ? 'moi-nhat' : params.sort;
  const cursor = decodeCursor(params.cursor);
  const at = now();

  const filters: Prisma.Sql[] = [
    Prisma.sql`p.visible = true AND p."deletedAt" IS NULL AND p."hiddenByAdminAt" IS NULL`,
    Prisma.sql`k."activeUntil" > ${at} AND k."lockedAt" IS NULL`,
  ];
  if (q) filters.push(matchClause(q));
  if (params.category) filters.push(Prisma.sql`p.category = ${params.category}`);
  if (params.province) filters.push(Prisma.sql`k.province = ${params.province}`);
  if (params.priceMin !== undefined) filters.push(Prisma.sql`p.price >= ${params.priceMin}`);
  if (params.priceMax !== undefined) filters.push(Prisma.sql`p.price <= ${params.priceMax}`);

  // Điểm phù hợp chỉ tính trên tên (mô tả dài, tính độ giống rất tốn): giống nhiều + chứa nguyên cụm thì cao.
  const score = q
    ? Prisma.sql`(word_similarity(${q}, p."searchName")
        + CASE WHEN p."searchName" LIKE ${`%${q}%`} THEN 0.5 ELSE 0 END)::float8`
    : Prisma.sql`0::float8`;

  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = ${WORD_SIMILARITY}`);
    return tx.$queryRaw<{ id: string; k1: number; k2: number; k3: number }[]>`
      WITH matched AS (
        SELECT p.id, p.stock, p.price, p."createdAt", s."sold30d", ${score} AS score
        FROM "Product" p
        JOIN "Kiot" k ON k.id = p."kiotId"
        LEFT JOIN "ProductSalesStat" s ON s."productId" = p.id
        WHERE ${Prisma.join(filters, ' AND ')}
      ), keyed AS (
        SELECT p.id,
          (CASE WHEN p.stock > 0 THEN 0 ELSE 1 END)::float8 AS k1,
          ${sortKey(sort)} AS k2,
          (-EXTRACT(EPOCH FROM p."createdAt") * 1000)::float8 AS k3
        FROM matched p
      )
      SELECT id, k1, k2, k3 FROM keyed
      ${cursor ? Prisma.sql`WHERE (k1, k2, k3, id) > (${cursor[0]}::float8, ${cursor[1]}::float8, ${cursor[2]}::float8, ${cursor[3]})` : Prisma.empty}
      ORDER BY k1, k2, k3, id
      LIMIT ${limit + 1}`;
  });

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: await hydrate(page.map((r) => r.id)),
    nextCursor: rows.length > limit && last ? encodeCursor([last.k1, last.k2, last.k3, last.id]) : null,
  };
}

export async function hydrate(ids: string[]): Promise<MarketCard[]> {
  if (ids.length === 0) return [];
  const [products, stats] = await Promise.all([
    db.product.findMany({
      where: { id: { in: ids } },
      include: {
        images: { orderBy: { position: 'asc' }, take: 1 },
        kiot: { select: { name: true, slug: true, province: true } },
      },
    }),
    db.productSalesStat.findMany({ where: { productId: { in: ids } } }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const sold = new Map(stats.map((s) => [s.productId, s.soldTotal]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    return [
      {
        id: p.id,
        name: p.name,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        stock: p.stock,
        thumbUrl: p.images[0]?.thumbUrl ?? null,
        url: `${kiotOrigin(p.kiot.slug)}${productPath(p)}`,
        kiotName: p.kiot.name,
        kiotSlug: p.kiot.slug,
        province: provinceName(p.kiot.province),
        sold: sold.get(p.id) ?? 0,
      },
    ];
  });
}
