import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { kiotOrigin } from '@/lib/urls';
import { productPath } from '@/modules/kiot';
import { visibleOnMarket } from './search';

// Một file sitemap chứa tối đa 50.000 link; giữ phần còn lại cho trang chính, danh mục và Kiot.
const MAX_PRODUCTS = 45_000;

export async function listSitemapEntries() {
  const at = now();
  const [kiots, products] = await Promise.all([
    db.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT k.slug, k."updatedAt" FROM "Kiot" k
      WHERE k."activeUntil" > ${at} AND k."lockedAt" IS NULL
      ORDER BY k."createdAt" LIMIT 4000`,
    db.$queryRaw<{ id: string; name: string; slug: string; updatedAt: Date }[]>`
      SELECT p.id, p.name, k.slug, p."updatedAt" FROM "Product" p JOIN "Kiot" k ON k.id = p."kiotId"
      WHERE ${visibleOnMarket(at)}
      ORDER BY p."updatedAt" DESC LIMIT ${MAX_PRODUCTS}`,
  ]);
  return {
    kiots: kiots.map((k) => ({ url: kiotOrigin(k.slug), updatedAt: k.updatedAt })),
    products: products.map((p) => ({
      url: `${kiotOrigin(p.slug)}${productPath(p)}`,
      updatedAt: p.updatedAt,
    })),
  };
}
