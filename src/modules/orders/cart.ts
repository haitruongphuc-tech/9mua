import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getVariant, hasVariants, isKiotActive } from '@/modules/kiot';
import { shippingFeeFor } from './shipping';

export const MAX_CART_LINES = 50;

export type CartProblem = 'OUT_OF_STOCK' | 'EXCEEDS_STOCK' | 'UNAVAILABLE';

export type CartLine = {
  productId: string;
  variantId: string | null; // biến thể (SPEC-kiot.md V5.6)
  variantLabel: string | null;
  name: string;
  price: number;
  qty: number;
  stock: number;
  imageUrl: string | null;
  sourceVideoId: string | null;
  sourceLiveId: string | null;
  problem: CartProblem | null;
};

export type CartGroup = {
  kiot: { id: string; name: string; slug: string; shippingFee: number; freeShippingThreshold: number | null };
  lines: CartLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  canCheckout: boolean;
};

export type Cart = { groups: CartGroup[]; grandTotal: number; lineCount: number; canCheckout: boolean };

type AddError =
  | { ok: false; error: 'UNAVAILABLE' | 'OWN_PRODUCT' | 'CART_FULL' | 'VARIANT_REQUIRED' }
  | { ok: false; error: 'EXCEEDS_STOCK'; stock: number };

async function loadSellable(productId: string) {
  const p = await db.product.findUnique({ where: { id: productId }, include: { kiot: true } });
  if (!p || !p.visible || p.deletedAt || p.hiddenByAdminAt || !isKiotActive(p.kiot, now())) return null;
  return p;
}

// Nguồn của món: video Creator (chuỗi, như cũ) hoặc { videoId } / { liveId } — buổi live (SPEC-live.md mục 7).
export type CartSource = string | { videoId?: string; liveId?: string };

export async function addToCart(
  userId: string,
  productId: string,
  qty: number,
  source?: CartSource,
  variantId?: string | null,
): Promise<{ ok: true } | AddError> {
  const sourceVideoId = typeof source === 'string' ? source : source?.videoId;
  const sourceLiveId = typeof source === 'object' ? source.liveId : undefined;
  if (!Number.isInteger(qty) || qty <= 0 || qty > 1000) return { ok: false, error: 'UNAVAILABLE' };
  const product = await loadSellable(productId);
  if (!product) return { ok: false, error: 'UNAVAILABLE' };
  // Chặn tự mua hàng của chính mình (doanh số ảo, luân chuyển tiền qua thu hộ).
  if (product.kiot.ownerId === userId) return { ok: false, error: 'OWN_PRODUCT' };
  // Sản phẩm có biến thể: phải chọn biến thể; giá và tồn kho theo biến thể. Giỏ giữ 1 biến thể mỗi sản phẩm
  // (bảng CartItem giữ khoá cũ userId + productId), chọn biến thể khác thì thay dòng cũ.
  const variant = variantId ? await getVariant(variantId) : null;
  if (
    variantId &&
    (!variant || variant.hidden || !(await db.productVariant.count({ where: { id: variantId, productId } })))
  )
    return { ok: false, error: 'UNAVAILABLE' };
  if (!variant && (await hasVariants(productId))) return { ok: false, error: 'VARIANT_REQUIRED' };
  const stock = variant ? variant.stock : product.stock;

  const existing = await db.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
  const sameLine = existing && (existing.variantId ?? null) === (variant?.id ?? null);
  const nextQty = (sameLine ? existing.qty : 0) + qty;
  if (nextQty > stock) return { ok: false, error: 'EXCEEDS_STOCK', stock };
  if (!existing && (await db.cartItem.count({ where: { userId } })) >= MAX_CART_LINES)
    return { ok: false, error: 'CART_FULL' };

  await db.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: {
      userId,
      productId,
      variantId: variant?.id ?? null,
      qty,
      sourceVideoId: sourceVideoId ?? null,
      sourceLiveId: sourceLiveId ?? null,
    },
    update: {
      qty: nextQty,
      variantId: variant?.id ?? null,
      ...(sourceVideoId ? { sourceVideoId } : {}),
      ...(sourceLiveId ? { sourceLiveId } : {}),
    },
  });
  return { ok: true };
}

export async function updateCartQty(
  userId: string,
  productId: string,
  qty: number,
): Promise<
  { ok: true } | { ok: false; error: 'EXCEEDS_STOCK'; stock: number } | { ok: false; error: 'INVALID_QTY' }
> {
  if (!Number.isInteger(qty) || qty < 0) return { ok: false, error: 'INVALID_QTY' };
  if (qty === 0) {
    await removeFromCart(userId, productId);
    return { ok: true };
  }
  const product = await db.product.findUnique({ where: { id: productId }, select: { stock: true } });
  const line = await db.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
  const variant = line?.variantId ? await getVariant(line.variantId) : null;
  const stock = variant ? variant.stock : product?.stock;
  if (stock !== undefined && qty > stock) return { ok: false, error: 'EXCEEDS_STOCK', stock };
  await db.cartItem.updateMany({ where: { userId, productId }, data: { qty } });
  return { ok: true };
}

export async function removeFromCart(userId: string, productId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { userId, productId } });
}

// Giỏ hàng nhóm theo Kiot, giá và tồn kho luôn đọc lại từ DB.
export async function getCart(userId: string): Promise<Cart> {
  const items = await db.cartItem.findMany({
    where: { userId },
    include: { product: { include: { kiot: true, images: { orderBy: { position: 'asc' }, take: 1 } } } },
    orderBy: { createdAt: 'asc' },
  });
  const variants = new Map(
    (
      await db.productVariant.findMany({
        where: { id: { in: items.flatMap((i) => (i.variantId ? [i.variantId] : [])) } },
      })
    ).map((v) => [v.id, v]),
  );
  const at = now();
  const groups = new Map<string, CartGroup>();
  for (const item of items) {
    const p = item.product;
    const v = item.variantId ? variants.get(item.variantId) : undefined;
    const price = v ? v.price : p.price;
    const stock = v ? v.stock : p.stock;
    const sellable =
      p.visible &&
      !p.deletedAt &&
      !p.hiddenByAdminAt &&
      isKiotActive(p.kiot, at) &&
      (!item.variantId || (v && !v.hidden));
    const problem: CartProblem | null = !sellable
      ? 'UNAVAILABLE'
      : stock <= 0
        ? 'OUT_OF_STOCK'
        : item.qty > stock
          ? 'EXCEEDS_STOCK'
          : null;
    const group =
      groups.get(p.kiotId) ??
      groups
        .set(p.kiotId, {
          kiot: {
            id: p.kiot.id,
            name: p.kiot.name,
            slug: p.kiot.slug,
            shippingFee: p.kiot.shippingFee,
            freeShippingThreshold: p.kiot.freeShippingThreshold,
          },
          lines: [],
          subtotal: 0,
          shippingFee: 0,
          total: 0,
          canCheckout: true,
        })
        .get(p.kiotId)!;
    group.lines.push({
      productId: p.id,
      variantId: v?.id ?? null,
      variantLabel: v ? [v.option1, v.option2].filter(Boolean).join(' / ') : null,
      name: p.name,
      price,
      qty: item.qty,
      stock,
      imageUrl: p.images[0]?.thumbUrl ?? null,
      sourceVideoId: item.sourceVideoId,
      sourceLiveId: item.sourceLiveId,
      problem,
    });
  }
  for (const g of groups.values()) {
    g.subtotal = g.lines.reduce((s, l) => s + l.price * l.qty, 0);
    g.shippingFee = shippingFeeFor(g.subtotal, g.kiot);
    g.total = g.subtotal + g.shippingFee;
    g.canCheckout = g.lines.every((l) => l.problem === null);
  }
  const list = [...groups.values()];
  return {
    groups: list,
    grandTotal: list.reduce((s, g) => s + g.total, 0),
    lineCount: items.length,
    canCheckout: list.length > 0 && list.every((g) => g.canCheckout),
  };
}
