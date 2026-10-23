'use server';

import { revalidatePath } from 'next/cache';
import { parseVndInput } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { updateShipping } from '@/modules/kiot';

export type ShippingFormState = { ok?: string; error?: string };

export async function updateShippingAction(
  _p: ShippingFormState,
  form: FormData,
): Promise<ShippingFormState> {
  const user = await requireUser();
  const result = await updateShipping(user.id, {
    shippingFee: parseVndInput(form.get('shippingFee')) ?? 0,
    freeShippingThreshold: parseVndInput(form.get('freeShippingThreshold')),
  });
  if (!result.ok) return { error: result.error === 'INVALID_INPUT' ? result.message : 'Bạn chưa có Kiot.' };
  revalidatePath('/kiot-cua-toi/cai-dat');
  return { ok: 'Đã lưu phí ship.' };
}
