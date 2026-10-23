'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/modules/identity';
import { removeFromCart, updateCartQty } from '@/modules/orders';

export async function setQtyAction(productId: string, form: FormData): Promise<void> {
  const user = await requireUser();
  await updateCartQty(user.id, productId, Math.max(0, Math.floor(Number(form.get('qty')) || 0)));
  revalidatePath('/gio-hang');
}

export async function removeAction(productId: string): Promise<void> {
  const user = await requireUser();
  await removeFromCart(user.id, productId);
  revalidatePath('/gio-hang');
}
