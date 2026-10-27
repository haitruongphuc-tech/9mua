'use server';

import { revalidatePath } from 'next/cache';
import { localizeFields } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { updateKiotAddress } from '@/modules/kiot';

export type AddressValues = { province: string; district: string; addressLine: string };
export type AddressFormState = {
  ok?: string;
  error?: string;
  fields?: Partial<Record<keyof AddressValues, string>>;
  values?: AddressValues;
};

export async function updateAddressAction(_p: AddressFormState, form: FormData): Promise<AddressFormState> {
  const user = await requireUser();
  const t = await getT();
  const values: AddressValues = {
    province: String(form.get('province') ?? ''),
    district: String(form.get('district') ?? ''),
    addressLine: String(form.get('addressLine') ?? ''),
  };
  const result = await updateKiotAddress(user.id, values);
  if (!result.ok)
    return result.error === 'INVALID_INPUT'
      ? { values, fields: localizeFields(t, result.fields) }
      : { values, error: t('seller.err.NO_KIOT') };
  revalidatePath('/kiot-cua-toi', 'layout');
  return { values, ok: t('seller.addr.saved') };
}
