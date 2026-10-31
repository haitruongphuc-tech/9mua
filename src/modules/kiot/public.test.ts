import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createSeller } from '../../../tests/helpers/factories';
import { getPublicKiot, getPublicProduct, listPublicProducts, productPath } from './public';

async function addProduct(
  kiotId: string,
  data: Partial<{
    name: string;
    stock: number;
    visible: boolean;
    deletedAt: Date;
    hiddenByAdminAt: Date;
  }> = {},
) {
  return db.product.create({
    data: {
      kiotId,
      name: data.name ?? 'Thanh long',
      price: 45_000,
      stock: data.stock ?? 5,
      category: 'nong-san',
      visible: data.visible ?? true,
      deletedAt: data.deletedAt,
      hiddenByAdminAt: data.hiddenByAdminAt,
      images: {
        create: { kiotId, url: '/uploads/a.webp', thumbUrl: '/uploads/a-400.webp', width: 10, height: 10 },
      },
    },
  });
}

describe('getPublicKiot', () => {
  it('Kiot đang hoạt động: ai cũng xem được', async () => {
    const { slug } = await createSeller({ active: true });
    expect(await getPublicKiot(slug, null)).toMatchObject({ preview: false, kiot: { slug } });
  });

  it('Kiot nháp: chỉ chủ xem trước, người khác không thấy', async () => {
    const { slug, user } = await createSeller();
    expect(await getPublicKiot(slug, null)).toBeNull();
    expect(await getPublicKiot(slug, 'nguoi-khac')).toBeNull();
    expect(await getPublicKiot(slug, user.id)).toMatchObject({ preview: true });
  });

  it('Kiot hết hạn hoặc bị khoá không hiện', async () => {
    const expired = await createSeller();
    await db.kiot.update({
      where: { id: expired.kiotId },
      data: { activeUntil: new Date(Date.now() - 1000) },
    });
    expect(await getPublicKiot(expired.slug, null)).toBeNull();
    const locked = await createSeller({ active: true });
    await db.kiot.update({ where: { id: locked.kiotId }, data: { lockedAt: new Date() } });
    expect(await getPublicKiot(locked.slug, null)).toBeNull();
    expect(await getPublicKiot(locked.slug, locked.user.id)).toBeNull();
  });

  it('không lộ số tài khoản hay thông tin riêng của chủ Kiot', async () => {
    const { slug } = await createSeller({ active: true });
    const result = await getPublicKiot(slug, null);
    expect(Object.keys(result!.kiot).sort()).toEqual(
      // Địa chỉ lấy hàng chi tiết (addressLine) giữ riêng, chỉ hiện tỉnh và quận.
      [
        'contactPhone',
        'coverUrl',
        'description',
        'district',
        'id',
        'layout', // giao diện Kiot (SPEC-kiot.md V5.3): chỉ là cách trình bày
        'logoUrl',
        'name',
        'province',
        'slug',
      ].sort(),
    );
  });
});

describe('listPublicProducts', () => {
  it('chỉ sản phẩm hiện, chưa xoá, chưa bị gỡ; hết hàng xếp cuối', async () => {
    const { kiotId } = await createSeller({ active: true });
    await addProduct(kiotId, { name: 'Hết hàng', stock: 0 });
    await addProduct(kiotId, { name: 'Còn hàng', stock: 3 });
    await addProduct(kiotId, { name: 'Ẩn', visible: false });
    await addProduct(kiotId, { name: 'Đã xoá', deletedAt: new Date() });
    await addProduct(kiotId, { name: 'Bị gỡ', hiddenByAdminAt: new Date() });
    const page = await listPublicProducts({ kiotId, limit: 20 });
    expect(page.items.map((p) => p.name)).toEqual(['Còn hàng', 'Hết hàng']);
    expect(page.items[0]).toMatchObject({ thumbUrl: '/uploads/a-400.webp', price: 45_000 });
  });
});

describe('thứ tự và phân trang', () => {
  it('trong nhóm còn hàng, mới nhất đứng trước (không xếp theo số lượng tồn)', async () => {
    const { kiotId } = await createSeller({ active: true });
    const old = await addProduct(kiotId, { name: 'Cũ nhiều hàng', stock: 100 });
    await db.product.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 86_400_000) },
    });
    await addProduct(kiotId, { name: 'Mới ít hàng', stock: 2 });
    const page = await listPublicProducts({ kiotId, limit: 20 });
    expect(page.items.map((p) => p.name)).toEqual(['Mới ít hàng', 'Cũ nhiều hàng']);
  });

  it('phân trang không trùng, không sót', async () => {
    const { kiotId } = await createSeller({ active: true });
    for (let i = 0; i < 7; i++) await addProduct(kiotId, { name: `SP ${i}`, stock: i % 3 });
    const first = await listPublicProducts({ kiotId, limit: 4 });
    const second = await listPublicProducts({ kiotId, limit: 4, cursor: first.nextCursor! });
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((p) => p.id);
    expect(new Set(ids).size).toBe(7);
  });
});

describe('getPublicProduct', () => {
  it('trả sản phẩm của đúng Kiot; sản phẩm Kiot khác hoặc bị ẩn thì null', async () => {
    const a = await createSeller({ active: true });
    const b = await createSeller({ active: true });
    const p = await addProduct(a.kiotId);
    const hidden = await addProduct(a.kiotId, { visible: false });
    expect(await getPublicProduct(a.slug, p.id, null)).toMatchObject({
      product: { id: p.id, images: [expect.any(Object)] },
    });
    expect(await getPublicProduct(b.slug, p.id, null)).toBeNull();
    expect(await getPublicProduct(a.slug, hidden.id, null)).toBeNull();
    expect(await getPublicProduct(a.slug, hidden.id, a.user.id)).toMatchObject({ preview: true });
  });

  it('productPath tạo đường dẫn đẹp có tên không dấu', () => {
    expect(productPath({ id: 'abc123', name: 'Thanh Long Ruột Đỏ 1kg' })).toBe(
      '/p/abc123-thanh-long-ruot-do-1kg',
    );
  });
});
