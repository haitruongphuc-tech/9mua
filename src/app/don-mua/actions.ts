'use server';

import { revalidatePath } from 'next/cache';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { setRefundAccount, submitDispute, transition } from '@/modules/orders';
import '@/server/orders';

export type BuyerActionState = { error?: string; ok?: string };

export async function receiveAction(orderId: string): Promise<void> {
  const user = await requireUser();
  await transition(orderId, 'receive', { userId: user.id, role: 'buyer' });
  revalidatePath(`/don-mua/${orderId}`);
}

export async function disputeAction(
  orderId: string,
  _p: BuyerActionState,
  form: FormData,
): Promise<BuyerActionState> {
  const user = await requireUser();
  const t = await getT();
  const result = await submitDispute(user.id, orderId, {
    message: String(form.get('message') ?? ''),
    images: form.getAll('imageIds').map(String),
  });
  if (!result.ok) return { error: t(`shop.dispute.err.${result.error}`) };
  revalidatePath(`/don-mua/${orderId}`);
  return { ok: t('shop.dispute.sent') };
}

export async function refundAccountAction(
  orderId: string,
  _p: BuyerActionState,
  form: FormData,
): Promise<BuyerActionState> {
  const user = await requireUser();
  const t = await getT();
  const result = await setRefundAccount(user.id, orderId, {
    bankBin: String(form.get('bankBin') ?? ''),
    accountNumber: String(form.get('accountNumber') ?? ''),
    accountName: String(form.get('accountName') ?? ''),
  });
  if (!result.ok)
    return { error: t(result.error === 'INVALID_INPUT' ? 'shop.refund.invalid' : 'shop.refund.wrongState') };
  revalidatePath(`/don-mua/${orderId}`);
  return { ok: t('shop.refund.saved') };
}
