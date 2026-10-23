import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createSeller, createUser, sampleImage } from '../../../tests/helpers/factories';
import {
  createProduct,
  deleteProduct,
  listProductsForOwner,
  MAX_PRODUCTS_PER_KIOT,
  updateProduct,
  uploadProductImage,
} from './product';

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), '9mua-products-'));
});

const base = {
  name: 'Thanh long ruột đỏ 1kg',
  description: 'Hái tại vườn',
  price: 45_000,
  stock: 20,
  category: 'nong-san',
  visible: true,
};

async function upload(userId: string, n = 1) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await uploadProductImage(userId, await sampleImage(i % 2 ? '#000' : '#fc6f15'));
    if (!r.ok) throw new Error(JSON.stringify(r));
    ids.push(r.image.id);
  }
  return ids;
}

describe('ảnh sản phẩm', () => {
  it('tải ảnh lên trước, chưa gắn sản phẩm', async () => {
    const { user } = await createSeller();
    const r = await uploadProductImage(user.id, await sampleImage());
    expect(r).toMatchObject({
      ok: true,
      image: {
        url: expect.stringMatching(/^\/uploads\/products\/.+\.webp$/),
        thumbUrl: expect.stringMatching(/-400\.webp$/),
      },
    });
    expect((await db.productImage.findFirstOrThrow()).productId).toBeNull();
  });

  it('chưa có Kiot không tải được; file không phải ảnh bị từ chối', async () => {
    const user = await createUser();
    expect(await uploadProductImage(user.id, await sampleImage())).toEqual({ ok: false, error: 'NO_KIOT' });
    const { user: seller } = await createSeller();
    expect(await uploadProductImage(seller.id, Buffer.from('not image'))).toEqual({
      ok: false,
      error: 'NOT_AN_IMAGE',
    });
  });
});

describe('tạo sản phẩm', () => {
  it('tạo với 1–6 ảnh theo đúng thứ tự', async () => {
    const { user } = await createSeller();
    const ids = await upload(user.id, 3);
    const r = await createProduct(user.id, { ...base, imageIds: [ids[2]!, ids[0]!, ids[1]!] });
    expect(r.ok).toBe(true);
    const p = await db.product.findFirstOrThrow({ include: { images: { orderBy: { position: 'asc' } } } });
    expect(p.images.map((i) => i.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it('bắt buộc 1–6 ảnh', async () => {
    const { user } = await createSeller();
    expect(await createProduct(user.id, { ...base, imageIds: [] })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { images: expect.any(String) },
    });
    const seven = await upload(user.id, 7);
    expect(await createProduct(user.id, { ...base, imageIds: seven })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { images: expect.any(String) },
    });
  });

  it('kiểm giá, giá gốc, tồn kho, danh mục', async () => {
    const { user } = await createSeller();
    const [img] = await upload(user.id);
    const bad = await createProduct(user.id, {
      ...base,
      name: 'A',
      price: 500,
      compareAtPrice: 400,
      stock: -1,
      category: 'vu-khi',
      imageIds: [img!],
    });
    expect(bad).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: {
        name: expect.any(String),
        price: expect.any(String),
        stock: expect.any(String),
        category: expect.any(String),
      },
    });
    const cmp = await createProduct(user.id, { ...base, compareAtPrice: 40_000, imageIds: [img!] });
    expect(cmp).toMatchObject({ ok: false, fields: { compareAtPrice: 'Giá gốc phải lớn hơn giá bán' } });
  });

  it('không dùng được ảnh của Kiot khác hoặc ảnh đã gắn sản phẩm khác', async () => {
    const a = await createSeller();
    const b = await createSeller();
    const [imgB] = await upload(b.user.id);
    expect(await createProduct(a.user.id, { ...base, imageIds: [imgB!] })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
      fields: { images: expect.any(String) },
    });
    const [imgA] = await upload(a.user.id);
    await createProduct(a.user.id, { ...base, imageIds: [imgA!] });
    expect(await createProduct(a.user.id, { ...base, imageIds: [imgA!] })).toMatchObject({
      ok: false,
      fields: { images: expect.any(String) },
    });
  });

  it(`tối đa ${MAX_PRODUCTS_PER_KIOT} sản phẩm mỗi Kiot`, async () => {
    const { user, kiotId } = await createSeller();
    await db.product.createMany({
      data: Array.from({ length: MAX_PRODUCTS_PER_KIOT }, (_, i) => ({
        kiotId,
        name: `SP ${i}`,
        price: 10_000,
        category: 'khac',
      })),
    });
    const [img] = await upload(user.id);
    expect(await createProduct(user.id, { ...base, imageIds: [img!] })).toEqual({
      ok: false,
      error: 'PRODUCT_LIMIT',
    });
  });
});

describe('sửa và xoá sản phẩm', () => {
  it('sửa thông tin, đổi thứ tự ảnh, bỏ và thêm ảnh', async () => {
    const { user } = await createSeller();
    const [a, b] = await upload(user.id, 2);
    const removedUrl = (await db.productImage.findUniqueOrThrow({ where: { id: b! } })).url;
    const created = await createProduct(user.id, { ...base, imageIds: [a!, b!] });
    if (!created.ok) throw new Error();
    const [c] = await upload(user.id);
    const r = await updateProduct(user.id, created.productId, {
      ...base,
      price: 39_000,
      visible: false,
      imageIds: [c!, a!],
    });
    expect(r).toEqual({ ok: true });
    const p = await db.product.findUniqueOrThrow({
      where: { id: created.productId },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    expect(p).toMatchObject({ price: 39_000, visible: false });
    expect(p.images.map((i) => i.id)).toEqual([c, a]);
    expect(await db.productImage.findUnique({ where: { id: b! } })).toBeNull();
    // File ảnh cũ vẫn giữ để đơn hàng đã mua hiển thị đúng ảnh.
    const { existsSync } = await import('node:fs');
    expect(existsSync(path.join(process.env.UPLOAD_DIR!, removedUrl.replace('/uploads/', '')))).toBe(true);
  });

  it('người khác không sửa/xoá được sản phẩm', async () => {
    const owner = await createSeller();
    const other = await createSeller();
    const [img] = await upload(owner.user.id);
    const created = await createProduct(owner.user.id, { ...base, imageIds: [img!] });
    if (!created.ok) throw new Error();
    const [img2] = await upload(other.user.id);
    expect(await updateProduct(other.user.id, created.productId, { ...base, imageIds: [img2!] })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await deleteProduct(other.user.id, created.productId)).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect((await db.product.findUniqueOrThrow({ where: { id: created.productId } })).deletedAt).toBeNull();
  });

  it('xoá mềm: không còn trong danh sách nhưng vẫn còn trong DB', async () => {
    const { user } = await createSeller();
    const [img] = await upload(user.id);
    const created = await createProduct(user.id, { ...base, imageIds: [img!] });
    if (!created.ok) throw new Error();
    expect(await deleteProduct(user.id, created.productId)).toEqual({ ok: true });
    expect(await listProductsForOwner(user.id)).toHaveLength(0);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: created.productId } })).deletedAt,
    ).not.toBeNull();
  });

  it('DB chặn tồn kho âm', async () => {
    const { kiotId } = await createSeller();
    await expect(
      db.product.create({ data: { kiotId, name: 'X', price: 10_000, stock: -1, category: 'khac' } }),
    ).rejects.toThrow();
  });
});
