import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { runOrderTick } from '@/server/orders';
import { createPaidOrder, createProduct, createSeller } from '../../../tests/helpers/factories';
import { getHomeSections, listKiots } from './home';

async function completed(qty = 1) {
  const o = await createPaidOrder({ qty });
  await db.order.update({
    where: { id: o.order.id },
    data: { status: 'delivered', deliveredAt: new Date(Date.now() - 8 * 86_400_000) },
  });
  await runOrderTick();
  return o;
}

describe('trang chủ', () => {
  it('số liệu là số thật; chưa có đơn thì "Bán chạy" trống và Kiot nổi bật là Kiot mới', async () => {
    const a = await createSeller({ active: true });
    await createProduct(a.kiotId, { name: 'Mứt gừng' });
    await createProduct(a.kiotId, { name: 'Mứt dừa' });
    const draft = await createSeller();
    await createProduct(draft.kiotId, { name: 'Nháp' });
    const empty = await createSeller({ active: true });

    const home = await getHomeSections();
    expect(home.stats).toEqual({ kiots: 2, products: 2 });
    expect(home.bestSellers).toEqual([]);
    expect(home.newest.map((p) => p.name).sort()).toEqual(['Mứt dừa', 'Mứt gừng']);
    expect(home.featuredLabel).toBe('new');
    expect(home.featuredKiots.map((k) => k.slug)).toEqual([a.slug]); // Kiot chưa có sản phẩm không hiện
    expect(home.featuredKiots.some((k) => k.slug === empty.slug)).toBe(false);
  });

  it('bán chạy và Kiot nổi bật theo đơn hoàn tất 30 ngày', async () => {
    const big = await completed(5);
    await completed(1);
    const home = await getHomeSections();
    expect(home.bestSellers[0]!.id).toBe(big.product.id);
    expect(home.featuredLabel).toBe('top');
    expect(home.featuredKiots).toHaveLength(2);
    expect(home.featuredKiots[0]!.completedOrders).toBe(1);
  });
});

describe('danh bạ Kiot', () => {
  it('lọc theo tỉnh và danh mục chính, sắp theo đơn hoàn tất', async () => {
    const seller = await completed(1);
    await db.kiot.update({ where: { id: seller.seller.kiotId }, data: { province: 'ha-noi' } });
    const b = await createSeller({ active: true });
    await db.kiot.update({ where: { id: b.kiotId }, data: { province: 'lam-dong' } });
    const p1 = await createProduct(b.kiotId, { name: 'Áo len' });
    const p2 = await createProduct(b.kiotId, { name: 'Khăn len' });
    await db.product.updateMany({ where: { id: { in: [p1.id, p2.id] } }, data: { category: 'thoi-trang' } });
    await createProduct(b.kiotId, { name: 'Trà atiso' });

    const all = await listKiots({});
    expect(all.items.map((k) => k.slug)).toEqual([seller.seller.slug, b.slug]);
    expect(all.items[1]).toMatchObject({ province: 'Lâm Đồng', mainCategory: 'Thời trang', products: 3 });
    expect((await listKiots({ province: 'lam-dong' })).items.map((k) => k.slug)).toEqual([b.slug]);
    expect((await listKiots({ category: 'thoi-trang' })).items.map((k) => k.slug)).toEqual([b.slug]);
    const paged = await listKiots({ limit: 1 });
    expect(paged.nextCursor).toBe('1');
    expect((await listKiots({ limit: 1, cursor: '1' })).items.map((k) => k.slug)).toEqual([b.slug]);
  });
});
