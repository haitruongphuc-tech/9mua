'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/modules/identity';
import { cancelCheckout, placeOrder } from '@/modules/orders';
import '@/server/payments';

export type CheckoutFormState = {
  message?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
};

const ADDRESS_KEYS = ['name', 'phone', 'province', 'district', 'ward', 'line'] as const;

export async function placeOrderAction(_p: CheckoutFormState, form: FormData): Promise<CheckoutFormState> {
  const user = await requireUser();
  const address = Object.fromEntries(ADDRESS_KEYS.map((k) => [k, String(form.get(k) ?? '')]));
  const notes: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (key.startsWith('note:')) notes[key.slice(5)] = String(value);
  const result = await placeOrder(user.id, { address, notes, saveAddress: form.get('saveAddress') === 'on' });
  if (!result.ok) {
    switch (result.error) {
      case 'INVALID_ADDRESS':
        return { fields: result.fields, values: address };
      case 'EMPTY_CART':
        redirect('/gio-hang');
      case 'OUT_OF_STOCK':
      case 'CART_INVALID':
        redirect('/gio-hang?loi=EXCEEDS_STOCK');
      default:
        return { values: address, message: 'Hệ thống thanh toán đang bận. Vui lòng thử lại sau ít phút.' };
    }
  }
  redirect(`/dat-hang/${result.checkoutId}`);
}

export async function cancelCheckoutAction(checkoutId: string): Promise<void> {
  const user = await requireUser();
  await cancelCheckout(user.id, checkoutId);
  redirect(`/dat-hang/${checkoutId}`);
}
