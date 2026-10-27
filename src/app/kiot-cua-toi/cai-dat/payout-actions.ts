'use server';

import { revalidatePath } from 'next/cache';
import { localizeFields } from '@/i18n/module-messages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { setPayoutAccount } from '@/modules/kiot';

export type PayoutFormState = {
  ok?: string;
  error?: string;
  fields?: Partial<Record<'bankBin' | 'accountNumber' | 'accountName', string>>;
  values?: { bankBin: string; accountNumber: string; accountName: string };
};

export async function setPayoutAccountAction(_p: PayoutFormState, form: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  const t = await getT();
  const values = {
    bankBin: String(form.get('bankBin') ?? ''),
    accountNumber: String(form.get('accountNumber') ?? ''),
    accountName: String(form.get('accountName') ?? ''),
  };
  const result = await setPayoutAccount(user.id, { ...values, password: String(form.get('password') ?? '') });
  if (!result.ok) {
    if (result.error === 'INVALID_INPUT') return { values, fields: localizeFields(t, result.fields) };
    return {
      values,
      error: t(result.error === 'WRONG_PASSWORD' ? 'seller.payacc.wrongPassword' : 'seller.err.NO_KIOT'),
    };
  }
  revalidatePath('/kiot-cua-toi/cai-dat');
  return { ok: t('seller.payacc.saved') };
}
