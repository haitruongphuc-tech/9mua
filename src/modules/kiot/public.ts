import type { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { isKiotActive } from './kiot';
import { slugify } from './slug';

// Chỉ những trường được phép hiện công khai (không có ownerId, tài khoản ngân hàng…).
const PUBLIC_KIOT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  contactPhone: true,
  logoUrl: true,
  coverUrl: true,
  province: true,
  district: true,
  layout: true, // giao diện Kiot (SPEC-kiot.md V5.3): công khai, chỉ là cách trình bày
} as const satisfies Prisma.KiotSelect;

export type PublicKiot = Prisma.KiotGetPayload<{ select: typeof PUBLIC_KIOT }>;

// Sản phẩm được hiện: người bán bật hiện, chưa xoá, chưa bị 9MUA gỡ.
export const PUBLIC_PRODUCT_WHERE = { visible: true, deletedAt: null, hiddenByAdminAt: null } as const;

export type ProductCard = {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  thumbUrl: string | null;
  path: string;
};

export type Page<T> = { items: T[]; nextCursor: string | null };

export function productPath(p: { id: string; name: string }): string {
  return `/p/${p.id}-${slugify(p.name) || 'san-pham'}`;
}

async function loadKiot(slug: string, viewerId: string | null) {
  const kiot = await db.kiot.findUnique({
    where: { slug },
    select: {
      ...PUBLIC_KIOT,
      ownerId: true,
      activeUntil: true,
      lockedAt: true,
      owner: { select: { displayName: true } },
    },
  });
  if (!kiot || kiot.lockedAt) return null;
  const isOwner = viewerId !== null && viewerId === kiot.ownerId;
  if (!isKiotActive(kiot, now()) && !isOwner) return null;
  const publicKiot = Object.fromEntries(
    Object.keys(PUBLIC_KIOT).map((k) => [k, kiot[k as keyof PublicKiot]]),
  ) as PublicKiot;
  return {
    kiot: publicKiot,
    preview: !isKiotActive(kiot, now()),
    isOwner,
    owner: { id: kiot.ownerId, displayName: kiot.owner.displayName },
  };
}

// Kiot công khai; chủ Kiot được xem trước khi còn nháp hoặc hết hạn (preview = true).
export async function getPublicKiot(
  slug: string,
  viewerId: string | null,
): Promise<{
  kiot: PublicKiot;
  preview: boolean;
  // Chỉ dùng ở máy chủ (trang Kiot V4: tên chủ, video của chủ, follow chủ). Không đưa id xuống trình duyệt.
  owner: { id: string; displayName: string };
} | null> {
  const found = await loadKiot(slug, viewerId);
  return found ? { kiot: found.kiot, preview: found.preview, owner: found.owner } : null;
}

// Số sản phẩm đang hiện trên trang Kiot (ô "Sản phẩm" của trang Kiot V4).
export function countPublicProducts(kiotId: string): Promise<number> {
  return db.product.count({ where: { kiotId, ...PUBLIC_PRODUCT_WHERE } });
}

// Chủ của một Kiot đang mở cửa (nút Follow trên trang Kiot là follow chủ Kiot). Kiot khoá/hết hạn: null.
export async function kiotOwnerId(kiotId: string): Promise<string | null> {
  const kiot = await db.kiot.findUnique({
    where: { id: kiotId },
    select: { ownerId: true, activeUntil: true, lockedAt: true },
  });
  return kiot && !kiot.lockedAt && isKiotActive(kiot, now()) ? kiot.ownerId : null;
}

// Trang Kiot: còn hàng trước, trong mỗi nhóm mới nhất trước. Mỗi Kiot ≤ 500 sản phẩm nên phân trang
// theo vị trí (cursor = số thứ tự bắt đầu) là đủ và đơn giản.
export async function listPublicProducts(filter: {
  kiotId: string;
  limit: number;
  cursor?: string;
}): Promise<Page<ProductCard>> {
  const offset = Math.max(Number(filter.cursor ?? 0) || 0, 0);
  const ids = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Product"
    WHERE "kiotId" = ${filter.kiotId} AND visible = true AND "deletedAt" IS NULL AND "hiddenByAdminAt" IS NULL
    ORDER BY (stock > 0) DESC, "createdAt" DESC, id ASC
    LIMIT ${filter.limit + 1} OFFSET ${offset}`;
  const pageIds = ids.slice(0, filter.limit).map((r) => r.id);
  const rows = await db.product.findMany({
    where: { id: { in: pageIds } },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    items: pageIds.map((id) => toCard(byId.get(id)!)),
    nextCursor: ids.length > filter.limit ? String(offset + filter.limit) : null,
  };
}

function toCard(p: {
  id: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: { thumbUrl: string }[];
}): ProductCard {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    thumbUrl: p.images[0]?.thumbUrl ?? null,
    path: productPath(p),
  };
}

export async function getPublicProduct(slug: string, productId: string, viewerId: string | null) {
  const found = await loadKiot(slug, viewerId);
  if (!found) return null;
  const product = await db.product.findFirst({
    where: {
      id: productId,
      kiotId: found.kiot.id,
      deletedAt: null,
      hiddenByAdminAt: null,
      ...(found.isOwner ? {} : { visible: true }),
    },
    include: { images: { orderBy: { position: 'asc' } } },
  });
  if (!product) return null;
  return { kiot: found.kiot, product, preview: found.preview || !product.visible };
}

// Tên, slug, logo của vài Kiot (thẻ người phát live, thẻ sản phẩm ghim). Chỉ trường công khai.
export function kiotBasics(
  ids: string[],
): Promise<{ id: string; slug: string; name: string; logoUrl: string | null }[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return db.kiot.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, logoUrl: true },
  });
}

// Khối "Sản phẩm nổi bật" của giao diện Kiot (SPEC-kiot.md V5.3): chỉ sản phẩm đang hiện, theo thứ tự chủ Kiot chọn.
export async function featuredProducts(kiotId: string, ids: string[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids }, kiotId, ...PUBLIC_PRODUCT_WHERE },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
  });
  return ids.flatMap((id) => {
    const p = rows.find((r) => r.id === id);
    return p ? [toCard(p)] : [];
  });
}
