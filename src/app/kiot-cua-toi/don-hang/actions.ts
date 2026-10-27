'use server';

import { revalidatePath } from 'next/cache';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { transition, type OrderAction } from '@/modules/orders';

export type SellerActionState = { error?: string };

const SELLER_ACTIONS = new Set<OrderAction>(['confirm', 'reject', 'ship', 'seller_cancel']);

export async function sellerOrderAction(
  orderId: string,
  _p: SellerActionState,
  form: FormData,
): Promise<SellerActionState> {
  const user = await requireUser();
  const t = await getT();
  const action = String(form.get('action')) as OrderAction;
  if (!SELLER_ACTIONS.has(action)) return { error: t('seller.act.err.INVALID_TRANSITION') };
  const result = await transition(
    orderId,
    action,
    { userId: user.id, role: 'seller' },
    {
      reason: String(form.get('reason') ?? ''),
      trackingCode: String(form.get('trackingCode') ?? ''),
      carrier: String(form.get('carrier') ?? ''),
    },
  );
  if (!result.ok) return { error: t(`seller.act.err.${result.error}`) };
  revalidatePath('/kiot-cua-toi/don-hang', 'layout');
  return {};
}
