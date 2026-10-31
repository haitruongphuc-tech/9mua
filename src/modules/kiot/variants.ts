import { db } from '@/lib/db';

// Biến thể sản phẩm (SPEC-kiot.md V5.6, công tắc variants): tối đa 2 nhóm tuỳ chọn (vd. Màu, Size), tối đa 50 biến
// thể. Mỗi biến thể có giá, giá gốc, tồn kho, ảnh (chọn từ ảnh sản phẩm), ẩn/hiện. Sản phẩm không có biến thể chạy như cũ.
export const MAX_VARIANTS = 50;
export const MAX_OPTION_GROUPS = 2;

export type VariantInput = {
  id?: string;
  option1: string;
  option2?: string | null;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  imageId?: string | null;
  hidden?: boolean;
};

export type VariantView = {
  id: string;
  label: string;
  option1: string;
  option2: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  imageId: string | null;
  hidden: boolean;
};

export const variantLabel = (v: { option1: string; option2: string | null }) =>
  [v.option1, v.option2].filter(Boolean).join(' / ');

const toView = (v: {
  id: string;
  option1: string;
  option2: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  imageId: string | null;
  hidden: boolean;
}): VariantView => ({ ...v, label: variantLabel(v) });

// Chủ Kiot lưu cả bộ biến thể. Biến thể bỏ khỏi danh sách thì ẩn (không xoá: đơn cũ còn trỏ tới).
export async function upsertVariants(
  ownerId: string,
  productId: string,
  input: { optionNames: string[]; variants: VariantInput[] },
): Promise<
  { ok: true } | { ok: false; error: 'NOT_FOUND' | 'INVALID' | 'TOO_MANY' | 'DUPLICATE' | 'IMAGE_INVALID' }
> {
  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null, kiot: { ownerId } },
    include: { images: { select: { id: true } } },
  });
  if (!product) return { ok: false, error: 'NOT_FOUND' };
  const names = input.optionNames.map((n) => n.trim().slice(0, 30)).filter(Boolean);
  if (names.length > MAX_OPTION_GROUPS) return { ok: false, error: 'INVALID' };
  if (input.variants.length > MAX_VARIANTS) return { ok: false, error: 'TOO_MANY' };
  const seen = new Set<string>();
  const clean: (VariantInput & { option1: string; option2: string | null })[] = [];
  for (const v of input.variants) {
    const option1 = v.option1.trim().slice(0, 40);
    const option2 = names.length > 1 ? (v.option2 ?? '').trim().slice(0, 40) || null : null;
    if (!option1 || (names.length > 1 && !option2)) return { ok: false, error: 'INVALID' };
    if (!Number.isInteger(v.price) || v.price < 1000 || v.price > 100_000_000)
      return { ok: false, error: 'INVALID' };
    if (v.compareAtPrice != null && (!Number.isInteger(v.compareAtPrice) || v.compareAtPrice <= v.price))
      return { ok: false, error: 'INVALID' };
    if (!Number.isInteger(v.stock) || v.stock < 0 || v.stock > 1_000_000)
      return { ok: false, error: 'INVALID' };
    if (v.imageId && !product.images.some((i) => i.id === v.imageId))
      return { ok: false, error: 'IMAGE_INVALID' };
    const key = `${option1.toLowerCase()}|${(option2 ?? '').toLowerCase()}`;
    if (seen.has(key)) return { ok: false, error: 'DUPLICATE' };
    seen.add(key);
    clean.push({ ...v, option1, option2 });
  }
  await db.$transaction(async (tx) => {
    await tx.product.update({ where: { id: productId }, data: { optionNames: clean.length ? names : [] } });
    const keep: string[] = [];
    for (const [position, v] of clean.entries()) {
      const data = {
        option1: v.option1,
        option2: v.option2,
        price: v.price,
        compareAtPrice: v.compareAtPrice ?? null,
        stock: v.stock,
        imageId: v.imageId ?? null,
        hidden: Boolean(v.hidden),
        position,
      };
      const existing = v.id ? await tx.productVariant.findFirst({ where: { id: v.id, productId } }) : null;
      const row = existing
        ? await tx.productVariant.update({ where: { id: existing.id }, data })
        : await tx.productVariant.create({ data: { ...data, productId } });
      keep.push(row.id);
    }
    await tx.productVariant.updateMany({ where: { productId, id: { notIn: keep } }, data: { hidden: true } });
  });
  return { ok: true };
}

// Biến thể của sản phẩm. publicOnly: chỉ biến thể đang hiện (trang sản phẩm, giỏ).
export async function productVariants(productId: string, publicOnly = true): Promise<VariantView[]> {
  const rows = await db.productVariant.findMany({
    where: { productId, ...(publicOnly ? { hidden: false } : {}) },
    orderBy: { position: 'asc' },
  });
  return rows.map(toView);
}

export async function getVariant(variantId: string) {
  const v = await db.productVariant.findUnique({ where: { id: variantId } });
  return v ? toView(v) : null;
}

// Sản phẩm có biến thể đang hiện thì người mua phải chọn biến thể.
export async function hasVariants(productId: string): Promise<boolean> {
  return (await db.productVariant.count({ where: { productId, hidden: false } })) > 0;
}

// Giá thấp nhất – cao nhất của các biến thể đang hiện (null nếu không có biến thể).
export async function variantPriceRange(productId: string): Promise<{ min: number; max: number } | null> {
  const r = await db.productVariant.aggregate({
    where: { productId, hidden: false },
    _min: { price: true },
    _max: { price: true },
  });
  return r._min.price === null || r._max.price === null ? null : { min: r._min.price, max: r._max.price };
}
