import { randomBytes } from 'node:crypto';
import type { Product, ProductImage } from '@prisma/client';
import { z } from 'zod';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { processImage, type ImageError } from '@/lib/media/process-image';
import { CATEGORY_SLUGS } from './categories';

export const MAX_PRODUCTS_PER_KIOT = 500;
export const MAX_IMAGES_PER_PRODUCT = 6;
const MAX_PENDING_IMAGES = 30; // ảnh đã tải lên nhưng chưa gắn sản phẩm (chống lạm dụng ổ đĩa)

const productInput = z
  .object({
    name: z.string().trim().min(2, 'Tên sản phẩm cần ít nhất 2 ký tự').max(120, 'Tên tối đa 120 ký tự'),
    description: z.string().trim().max(5000, 'Mô tả tối đa 5.000 ký tự').default(''),
    price: z.coerce
      .number({ error: 'Nhập giá bán' })
      .int('Giá phải là số nguyên')
      .min(1000, 'Giá bán tối thiểu 1.000đ')
      .max(100_000_000, 'Giá bán tối đa 100.000.000đ'),
    compareAtPrice: z.coerce.number().int('Giá phải là số nguyên').positive().nullish(),
    stock: z.coerce
      .number({ error: 'Nhập tồn kho' })
      .int('Tồn kho là số nguyên')
      .min(0, 'Tồn kho không âm')
      .max(1_000_000),
    category: z.enum(CATEGORY_SLUGS, { error: 'Chọn danh mục' }),
    visible: z.boolean().default(true),
    imageIds: z
      .array(z.string())
      .min(1, 'Cần ít nhất 1 ảnh')
      .max(MAX_IMAGES_PER_PRODUCT, `Tối đa ${MAX_IMAGES_PER_PRODUCT} ảnh`)
      .refine((ids) => new Set(ids).size === ids.length, 'Ảnh bị trùng'),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice > v.price, {
    path: ['compareAtPrice'],
    message: 'Giá gốc phải lớn hơn giá bán',
  });

// Dữ liệu thô từ form (chưa kiểm tra); zod kiểm và chuẩn hoá trong parse().
export type ProductInput = {
  name: string;
  description?: string;
  price: unknown;
  compareAtPrice?: unknown;
  stock: unknown;
  category: string;
  visible?: boolean;
  imageIds: string[];
};
type Field = 'name' | 'description' | 'price' | 'compareAtPrice' | 'stock' | 'category' | 'images';
type InvalidInput = { ok: false; error: 'INVALID_INPUT'; fields: Partial<Record<Field, string>> };

function parse(raw: ProductInput) {
  const parsed = productInput.safeParse(raw);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fields: Partial<Record<Field, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = (issue.path[0] === 'imageIds' ? 'images' : issue.path[0]) as Field;
    fields[key] ??= issue.message;
  }
  return { ok: false as const, error: 'INVALID_INPUT' as const, fields };
}

async function ownerKiotId(userId: string): Promise<string | null> {
  return (await db.kiot.findUnique({ where: { ownerId: userId }, select: { id: true } }))?.id ?? null;
}

export async function uploadProductImage(
  userId: string,
  data: Buffer,
): Promise<
  | { ok: true; image: Pick<ProductImage, 'id' | 'url' | 'thumbUrl'> }
  | { ok: false; error: 'NO_KIOT' | 'TOO_MANY_PENDING' | ImageError }
> {
  const kiotId = await ownerKiotId(userId);
  if (!kiotId) return { ok: false, error: 'NO_KIOT' };
  const pending = await db.productImage.count({ where: { kiotId, productId: null } });
  if (pending >= MAX_PENDING_IMAGES) return { ok: false, error: 'TOO_MANY_PENDING' };

  const processed = await processImage(data);
  if (!processed.ok) return processed;

  const t = now();
  const key = `products/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(12).toString('base64url')}`;
  const store = imageStore();
  const url = await store.save(`${key}.webp`, processed.main);
  const thumbUrl = await store.save(`${key}-400.webp`, processed.thumb);
  try {
    const image = await db.productImage.create({
      data: { kiotId, url, thumbUrl, width: processed.width, height: processed.height },
      select: { id: true, url: true, thumbUrl: true },
    });
    return { ok: true, image };
  } catch (error) {
    await Promise.all([store.remove(url), store.remove(thumbUrl)]);
    throw error;
  }
}

// Ảnh hợp lệ: cùng Kiot, và chưa gắn sản phẩm nào hoặc đang gắn chính sản phẩm này.
async function checkImages(kiotId: string, imageIds: string[], productId: string | null) {
  const images = await db.productImage.findMany({ where: { id: { in: imageIds }, kiotId } });
  return (
    images.length === imageIds.length &&
    images.every((i) => i.productId === null || i.productId === productId)
  );
}

export async function createProduct(
  userId: string,
  raw: ProductInput,
): Promise<
  { ok: true; productId: string } | { ok: false; error: 'NO_KIOT' | 'PRODUCT_LIMIT' } | InvalidInput
> {
  const kiotId = await ownerKiotId(userId);
  if (!kiotId) return { ok: false, error: 'NO_KIOT' };
  const input = parse(raw);
  if (!input.ok) return input;
  const { imageIds, ...data } = input.data;

  if ((await db.product.count({ where: { kiotId, deletedAt: null } })) >= MAX_PRODUCTS_PER_KIOT) {
    return { ok: false, error: 'PRODUCT_LIMIT' };
  }
  if (!(await checkImages(kiotId, imageIds, null))) {
    return { ok: false, error: 'INVALID_INPUT', fields: { images: 'Ảnh không hợp lệ, hãy tải lại ảnh' } };
  }

  const product = await db
    .$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...data, kiotId } });
      for (const [position, id] of imageIds.entries()) {
        // Điều kiện productId = null chặn hai sản phẩm giành cùng một ảnh khi lưu đồng thời.
        const claimed = await tx.productImage.updateMany({
          where: { id, kiotId, productId: null },
          data: { productId: created.id, position },
        });
        if (claimed.count !== 1) throw new ImageConflict();
      }
      return created;
    })
    .catch((e) => (e instanceof ImageConflict ? null : Promise.reject(e)));
  if (!product)
    return { ok: false, error: 'INVALID_INPUT', fields: { images: 'Ảnh không hợp lệ, hãy tải lại ảnh' } };
  return { ok: true, productId: product.id };
}

class ImageConflict extends Error {}

async function findOwnedProduct(userId: string, productId: string) {
  return db.product.findFirst({ where: { id: productId, deletedAt: null, kiot: { ownerId: userId } } });
}

export async function updateProduct(
  userId: string,
  productId: string,
  raw: ProductInput,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' } | InvalidInput> {
  const product = await findOwnedProduct(userId, productId);
  if (!product) return { ok: false, error: 'NOT_FOUND' };
  const input = parse(raw);
  if (!input.ok) return input;
  const { imageIds, ...data } = input.data;
  if (!(await checkImages(product.kiotId, imageIds, product.id))) {
    return { ok: false, error: 'INVALID_INPUT', fields: { images: 'Ảnh không hợp lệ, hãy tải lại ảnh' } };
  }

  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data });
    // Chỉ gỡ ảnh khỏi sản phẩm, KHÔNG xoá file: đơn hàng cũ vẫn hiển thị ảnh lúc mua qua URL đã chụp lại.
    await tx.productImage.deleteMany({ where: { productId: product.id, id: { notIn: imageIds } } });
    for (const [position, id] of imageIds.entries()) {
      await tx.productImage.update({ where: { id }, data: { productId: product.id, position } });
    }
  });
  return { ok: true };
}

export async function deleteProduct(
  userId: string,
  productId: string,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' }> {
  const product = await findOwnedProduct(userId, productId);
  if (!product) return { ok: false, error: 'NOT_FOUND' };
  await db.product.update({ where: { id: product.id }, data: { deletedAt: now(), visible: false } });
  return { ok: true };
}

export type OwnerProduct = Product & { images: ProductImage[] };

export function listProductsForOwner(userId: string): Promise<OwnerProduct[]> {
  return db.product.findMany({
    where: { deletedAt: null, kiot: { ownerId: userId } },
    include: { images: { orderBy: { position: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

export function getProductForOwner(userId: string, productId: string): Promise<OwnerProduct | null> {
  return db.product.findFirst({
    where: { id: productId, deletedAt: null, kiot: { ownerId: userId } },
    include: { images: { orderBy: { position: 'asc' } } },
  });
}
