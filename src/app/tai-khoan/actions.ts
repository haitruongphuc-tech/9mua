'use server';

import { revalidatePath } from 'next/cache';
import { getT } from '@/i18n/server';
import {
  changeEmail,
  changePassword,
  getCurrentSessionId,
  requireUser,
  updateProfile,
} from '@/modules/identity';

export type FormState = { ok?: string; error?: string; email?: string };

export async function updateProfileAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const result = await updateProfile(user.id, { displayName: String(form.get('displayName') ?? '') });
  if (!result.ok) return { error: t('auth.err.displayName') };
  revalidatePath('/tai-khoan', 'layout');
  return { ok: t('me.settings.nameSaved') };
}

export async function changeEmailAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const email = String(form.get('email') ?? '');
  const result = await changeEmail(user.id, { email, password: String(form.get('password') ?? '') });
  if (!result.ok) return { error: t(`me.settings.err.${result.error}`), email };
  revalidatePath('/tai-khoan', 'layout');
  return { ok: t('me.settings.emailSaved') };
}

export async function changePasswordAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const sessionId = await getCurrentSessionId();
  const newPassword = String(form.get('newPassword') ?? '');
  if (newPassword !== String(form.get('confirm') ?? '')) return { error: t('me.settings.mismatch') };
  const result = await changePassword(user.id, sessionId!, {
    oldPassword: String(form.get('oldPassword') ?? ''),
    newPassword,
  });
  if (!result.ok) {
    return {
      error: t(result.error === 'WRONG_PASSWORD' ? 'me.settings.wrongCurrent' : 'me.settings.passwordLength'),
    };
  }
  revalidatePath('/tai-khoan', 'layout');
  return { ok: t('me.settings.passwordSaved') };
}
