import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { isKiotActive } from '@/modules/kiot';
import { shippingFeeFor } from './shipping';

export const MAX_CART_LINES = 50;

export type CartProblem = 'OUT_OF_STOCK' | 'EXCEEDS_STOCK' | 'UNAVAILABLE';

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  stock: number;
  imageUrl: string | null;
  sourceVideoId: string | null;
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
  | { ok: false; error: 'UNAVAILABLE' | 'OWN_PRODUCT' | 'CART_FULL' }
  | { ok: false; error: 'EXCEEDS_STOCK'; stock: number };

async function loadSellable(productId: string) {
  const p = await db.product.findUnique({ where: { id: productId }, include: { kiot: true } });
  if (!p || !p.visible || p.deletedAt || p.hiddenByAdminAt || !isKiotActive(p.kiot, now())) return null;
  return p;
}

export async function addToCart(
  userId: string,
  productId: string,
  qty: number,
  sourceVideoId?: string,
): Promise<{ ok: true } | AddError> {
  if (!Number.isInteger(qty) || qty <= 0 || qty > 1000) return { ok: false, error: 'UNAVAILABLE' };
  const product = await loadSellable(productId);
  if (!product) return { ok: false, error: 'UNAVAILABLE' };
  // Chặn tự mua hàng của chính mình (doanh số ảo, luân chuyển tiền qua thu hộ).
  if (product.kiot.ownerId === userId) return { ok: false, error: 'OWN_PRODUCT' };

  const existing = await db.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
  const nextQty = (existing?.qty ?? 0) + qty;
  if (nextQty > product.stock) return { ok: false, error: 'EXCEEDS_STOCK', stock: product.stock };
  if (!existing && (await db.cartItem.count({ where: { userId } })) >= MAX_CART_LINES)
    return { ok: false, error: 'CART_FULL' };

  await db.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, qty, sourceVideoId: sourceVideoId ?? null },
    update: { qty: nextQty, ...(sourceVideoId ? { sourceVideoId } : {}) },
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
  if (product && qty > product.stock) return { ok: false, error: 'EXCEEDS_STOCK', stock: product.stock };
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
  const at = now();
  const groups = new Map<string, CartGroup>();
  for (const item of items) {
    const p = item.product;
    const sellable = p.visible && !p.deletedAt && !p.hiddenByAdminAt && isKiotActive(p.kiot, at);
    const problem: CartProblem | null = !sellable
      ? 'UNAVAILABLE'
      : p.stock <= 0
        ? 'OUT_OF_STOCK'
        : item.qty > p.stock
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
      name: p.name,
      price: p.price,
      qty: item.qty,
      stock: p.stock,
      imageUrl: p.images[0]?.thumbUrl ?? null,
      sourceVideoId: item.sourceVideoId,
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
