import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createProduct, createSeller } from '../../../tests/helpers/factories';
import { listSitemapEntries } from './sitemap';

describe('sitemap', () => {
  it('chỉ có Kiot và sản phẩm đang hoạt động', async () => {
    const live = await createSeller({ active: true });
    await createProduct(live.kiotId, { name: 'Hiện' });
    const hidden = await createProduct(live.kiotId, { name: 'Ẩn' });
    await db.product.update({ where: { id: hidden.id }, data: { visible: false } });
    const draft = await createSeller();
    await createProduct(draft.kiotId, { name: 'Nháp' });

    const { kiots, products } = await listSitemapEntries();
    expect(kiots.map((k) => k.url)).toEqual([expect.stringContaining(`//${live.slug}.`)]);
    expect(products).toHaveLength(1);
    expect(products[0]!.url).toMatch(new RegExp(`//${live.slug}\\..+/p/.+-hien$`));
  });
});
