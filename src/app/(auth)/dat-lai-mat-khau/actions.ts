'use server';

import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { completePasswordReset } from '@/modules/identity';

export type ResetFormState = { error?: string };

export async function resetPasswordAction(_prev: ResetFormState, form: FormData): Promise<ResetFormState> {
  const t = await getT();
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('confirm') ?? '')) return { error: t('auth.reset.mismatch') };

  const result = await completePasswordReset(String(form.get('token') ?? ''), password);
  if (!result.ok) {
    return { error: t(result.error === 'INVALID_PASSWORD' ? 'auth.err.password' : 'auth.reset.expired') };
  }
  redirect('/dang-nhap?da-dat-lai=1');
}
