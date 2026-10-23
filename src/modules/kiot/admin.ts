import type { Tx } from '@/lib/db';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { isKiotActive } from './kiot';

// Các hàm dưới đây chỉ module admin/billing gọi (SPEC-kiot.md "Hợp đồng"); audit log ghi ở module admin.

export async function lockKiot(kiotId: string, reason: string): Promise<void> {
  await db.kiot.update({ where: { id: kiotId }, data: { lockedAt: now(), lockReason: reason } });
}

export async function unlockKiot(kiotId: string): Promise<void> {
  await db.kiot.update({ where: { id: kiotId }, data: { lockedAt: null, lockReason: null } });
}

export async function hideProduct(productId: string, reason: string): Promise<void> {
  await db.product.update({
    where: { id: productId },
    data: { hiddenByAdminAt: now(), hiddenReason: reason },
  });
}

export async function unhideProduct(productId: string): Promise<void> {
  await db.product.update({ where: { id: productId }, data: { hiddenByAdminAt: null, hiddenReason: null } });
}

// Chỉ billing gọi, trong transaction ghi nhận tiền phí thuê.
export async function extendActiveUntil(tx: Tx, kiotId: string, until: Date): Promise<void> {
  await tx.kiot.update({ where: { id: kiotId }, data: { activeUntil: until } });
}

export type CheckoutProduct = {
  id: string;
  kiotId: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  available: boolean; // còn được bán: sản phẩm hiện + Kiot đang hoạt động
};

export async function getProductForCheckout(
  productId: string,
  at: Date = now(),
): Promise<CheckoutProduct | null> {
  const p = await db.product.findUnique({
    where: { id: productId },
    include: { kiot: true, images: { orderBy: { position: 'asc' }, take: 1 } },
  });
  if (!p) return null;
  const available = p.visible && !p.deletedAt && !p.hiddenByAdminAt && isKiotActive(p.kiot, at);
  return {
    id: p.id,
    kiotId: p.kiotId,
    name: p.name,
    price: p.price,
    stock: p.stock,
    imageUrl: p.images[0]?.thumbUrl ?? null,
    available,
  };
}
