import { describe, expect, it } from 'vitest';
import { advanceClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { lockKiot } from '@/modules/kiot';
import { runOrderTick } from '@/server/orders';
import { createPaidOrder, createProduct, createSeller } from '../../../tests/helpers/factories';
import { searchProducts } from './search';
import { refreshSales30d } from './stats';

async function sellerIn(province: string | null = 'lam-dong') {
  const s = await createSeller({ active: true });
  await db.kiot.update({ where: { id: s.kiotId }, data: { province } });
  return s;
}

const names = async (params: Parameters<typeof searchProducts>[0], limit?: number) =>
  (await searchProducts(params, limit)).items.map((i) => i.name);

describe('tìm kiếm tiếng Việt', () => {
  it('có dấu, không dấu, viết hoa, gõ sai nhẹ đều ra', async () => {
    const s = await sellerIn();
    await createProduct(s.kiotId, { name: 'Thanh Long Bình Thuận' });
    await createProduct(s.kiotId, { name: 'Áo thun cotton' });
    for (const q of ['thanh long', 'THANH LONG', 'thanh lòng', 'thnah long', 'Thanh  long  binh'])
      expect(await names({ q, sort: 'phu-hop' }), q).toEqual(['Thanh Long Bình Thuận']);
    expect(await names({ q: 'ao thun', sort: 'phu-hop' })).toEqual(['Áo thun cotton']);
    expect(await names({ q: 'đồng hồ', sort: 'phu-hop' })).toEqual([]);
  });

  it('khớp tên xếp trên khớp mô tả', async () => {
    const s = await sellerIn();
    const desc = await createProduct(s.kiotId, { name: 'Nước ép trái cây' });
    await db.product.update({ where: { id: desc.id }, data: { description: 'Làm từ thanh long ruột đỏ' } });
    await createProduct(s.kiotId, { name: 'Thanh long ruột đỏ' });
    expect(await names({ q: 'thanh long', sort: 'phu-hop' })).toEqual([
      'Thanh long ruột đỏ',
      'Nước ép trái cây',
    ]);
  });

  it('không bao giờ hiện hàng của Kiot hết hạn/bị khoá/nháp, sản phẩm ẩn, đã xoá, bị gỡ', async () => {
    const ok = await sellerIn();
    await createProduct(ok.kiotId, { name: 'Cam sành hiện' });
    const expired = await sellerIn();
    await createProduct(expired.kiotId, { name: 'Cam sành hết hạn' });
    await db.kiot.update({
      where: { id: expired.kiotId },
      data: { activeUntil: new Date(Date.now() - 1000) },
    });
    const locked = await sellerIn();
    await createProduct(locked.kiotId, { name: 'Cam sành bị khoá' });
    await lockKiot(locked.kiotId, 'vi phạm');
    const draft = await createSeller();
    await createProduct(draft.kiotId, { name: 'Cam sành nháp' });
    const hidden = await createProduct(ok.kiotId, { name: 'Cam sành ẩn' });
    await db.product.update({ where: { id: hidden.id }, data: { visible: false } });
    const deleted = await createProduct(ok.kiotId, { name: 'Cam sành xoá' });
    await db.product.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    const removed = await createProduct(ok.kiotId, { name: 'Cam sành bị gỡ' });
    await db.product.update({ where: { id: removed.id }, data: { hiddenByAdminAt: new Date() } });

    expect(await names({ q: 'cam sanh', sort: 'phu-hop' })).toEqual(['Cam sành hiện']);
    expect(await names({ sort: 'moi-nhat' })).toEqual(['Cam sành hiện']);
  });

  it('hết hàng xếp cuối ở mọi kiểu sắp xếp', async () => {
    const s = await sellerIn();
    await createProduct(s.kiotId, { name: 'Gạo hết hàng', price: 10_000, stock: 0 });
    await createProduct(s.kiotId, { name: 'Gạo ST25', price: 30_000 });
    await createProduct(s.kiotId, { name: 'Gạo nếp', price: 20_000 });
    expect(await names({ sort: 'gia-tang' })).toEqual(['Gạo nếp', 'Gạo ST25', 'Gạo hết hàng']);
    expect(await names({ sort: 'gia-giam' })).toEqual(['Gạo ST25', 'Gạo nếp', 'Gạo hết hàng']);
    expect((await names({ q: 'gao', sort: 'phu-hop' })).at(-1)).toBe('Gạo hết hàng');
  });

  it('lọc theo danh mục, tỉnh, khoảng giá', async () => {
    const a = await sellerIn('lam-dong');
    const b = await sellerIn('ha-noi');
    const p1 = await createProduct(a.kiotId, { name: 'Dâu tây Đà Lạt', price: 120_000 });
    await db.product.update({ where: { id: p1.id }, data: { category: 'nong-san' } });
    const p2 = await createProduct(b.kiotId, { name: 'Áo dài lụa', price: 900_000 });
    await db.product.update({ where: { id: p2.id }, data: { category: 'thoi-trang' } });
    expect(await names({ category: 'nong-san', sort: 'moi-nhat' })).toEqual(['Dâu tây Đà Lạt']);
    expect(await names({ province: 'ha-noi', sort: 'moi-nhat' })).toEqual(['Áo dài lụa']);
    expect(await names({ priceMin: 100_000, priceMax: 200_000, sort: 'moi-nhat' })).toEqual([
      'Dâu tây Đà Lạt',
    ]);
  });

  it('phân trang con trỏ: không trùng, không sót khi có sản phẩm mới chen vào', async () => {
    const s = await sellerIn();
    for (let i = 0; i < 30; i++) {
      await createProduct(s.kiotId, { name: `Sản phẩm ${i}`, price: 1_000 + (i % 7) * 1_000 });
      advanceClock({ seconds: 1 });
    }
    for (const sort of ['moi-nhat', 'gia-tang', 'gia-giam', 'ban-chay'] as const) {
      const first = await searchProducts({ sort }, 24);
      expect(first.items).toHaveLength(24);
      await createProduct(s.kiotId, { name: `Chen ngang ${sort}`, price: 1_500 });
      const second = await searchProducts({ sort, cursor: first.nextCursor! }, 24);
      const seen = [...first.items, ...second.items]
        .map((i) => i.name)
        .filter((n) => n.startsWith('Sản phẩm'));
      expect(new Set(seen).size, sort).toBe(30);
      expect(seen.length, sort).toBe(30);
    }
    expect((await searchProducts({ sort: 'moi-nhat', cursor: 'rác' }, 5)).items).toHaveLength(5);
  });

  it('thẻ sản phẩm có tên Kiot, tỉnh và link sang trang Kiot', async () => {
    const s = await sellerIn('lam-dong');
    await createProduct(s.kiotId, { name: 'Atiso khô' });
    const [card] = (await searchProducts({ sort: 'moi-nhat' })).items;
    expect(card).toMatchObject({ kiotSlug: s.slug, province: 'Lâm Đồng', sold: 0 });
    expect(card!.url).toMatch(new RegExp(`^http://${s.slug}\\.localhost(:\\d+)?/p/[a-z0-9]+-atiso-kho$`));
  });
});

describe('đã bán và bán chạy', () => {
  async function completeOrder(qty: number) {
    const o = await createPaidOrder({ qty });
    await db.order.update({
      where: { id: o.order.id },
      data: { status: 'delivered', deliveredAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await runOrderTick();
    return o;
  }

  it('đơn hoàn tất thì "Đã bán" tăng đúng số lượng; sắp theo bán chạy', async () => {
    const o = await completeOrder(3);
    await db.kiot.update({ where: { id: o.seller.kiotId }, data: { province: 'ha-noi' } });
    expect(await db.order.findUniqueOrThrow({ where: { id: o.order.id } })).toMatchObject({
      status: 'completed',
    });
    await runOrderTick(); // chạy lại không cộng thêm
    const card = (await searchProducts({ sort: 'ban-chay' })).items.find((i) => i.id === o.product.id);
    expect(card?.sold).toBe(3);
    expect(await db.productSalesStat.findUniqueOrThrow({ where: { productId: o.product.id } })).toMatchObject(
      {
        sold30d: 3,
        soldTotal: 3,
      },
    );

    const other = await sellerIn();
    await createProduct(other.kiotId, { name: 'Chưa bán được' });
    expect((await searchProducts({ sort: 'ban-chay' })).items[0]!.id).toBe(o.product.id);
  });

  it('sau 30 ngày, "bán chạy 30 ngày" về 0 nhưng tổng đã bán giữ nguyên', async () => {
    const o = await completeOrder(2);
    advanceClock({ days: 31 });
    await refreshSales30d();
    expect(await db.productSalesStat.findUniqueOrThrow({ where: { productId: o.product.id } })).toMatchObject(
      {
        sold30d: 0,
        soldTotal: 2,
      },
    );
  });
});

describe('tên chuẩn hoá cho tìm kiếm', () => {
  it('DB tự điền khi tạo và khi đổi tên sản phẩm', async () => {
    const s = await sellerIn();
    const p = await createProduct(s.kiotId, { name: 'Bưởi Năm Roi' });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).searchName).toBe('buoi nam roi');
    await db.product.update({ where: { id: p.id }, data: { name: 'Đậu phộng rang' } });
    expect(await names({ q: 'dau phong', sort: 'phu-hop' })).toEqual(['Đậu phộng rang']);
    expect(await names({ q: 'buoi nam roi', sort: 'phu-hop' })).toEqual([]);
  });
});
