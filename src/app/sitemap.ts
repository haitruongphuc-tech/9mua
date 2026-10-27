import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { POLICY_SLUGS } from '@/content/legal';
import { CATEGORIES } from '@/modules/kiot';
import { listSitemapEntries } from '@/modules/marketplace';

// Chỉ Kiot và sản phẩm đang hoạt động (SPEC-marketplace.md mục 7). Link tenkiot.9mua.com được Google nhận
// khi tên miền 9mua.com đã xác minh dạng "Domain property" trong Search Console (xem docs/deploy.md).
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const app = env().APP_URL;
  const { kiots, products } = await listSitemapEntries();
  return [
    { url: `${app}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${app}/cho`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${app}/cho/kiot`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${app}/gioi-thieu`, changeFrequency: 'monthly', priority: 0.4 },
    ...POLICY_SLUGS.map((s) => ({
      url: `${app}/chinh-sach/${s}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${app}/cho/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...kiots.map((k) => ({ url: k.url, lastModified: k.updatedAt, priority: 0.7 })),
    ...products.map((p) => ({ url: p.url, lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
