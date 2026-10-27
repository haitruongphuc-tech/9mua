'use server';

import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
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
    const t = await getT();
    switch (result.error) {
      case 'INVALID_ADDRESS': {
        // Lỗi từng ô theo ngôn ngữ đang chọn (module orders chỉ báo ô nào sai).
        const fields: Record<string, string> = {};
        for (const k of ADDRESS_KEYS)
          if (result.fields[k])
            fields[k] =
              k === 'name' || k === 'phone'
                ? t(`shop.checkout.err.${k}`)
                : t('shop.checkout.err.field', { label: t(`shop.checkout.${k}`) });
        return { fields, values: address };
      }
      case 'EMPTY_CART':
        redirect('/gio-hang');
      case 'OUT_OF_STOCK':
      case 'CART_INVALID':
        redirect('/gio-hang?loi=EXCEEDS_STOCK');
      default:
        return { values: address, message: t('shop.checkout.busy') };
    }
  }
  redirect(`/dat-hang/${result.checkoutId}`);
}

export async function cancelCheckoutAction(checkoutId: string): Promise<void> {
  const user = await requireUser();
  await cancelCheckout(user.id, checkoutId);
  redirect(`/dat-hang/${checkoutId}`);
}
