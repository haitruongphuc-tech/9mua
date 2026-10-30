'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getT } from '@/i18n/server';
import {
  changeEmail,
  changePassword,
  getCurrentSessionId,
  requestEmailOtp,
  requireUser,
  setHandle,
  setPasswordWithOtp,
  updateProfile,
} from '@/modules/identity';
import { isFeatureOn } from '@/lib/features';

export type FormState = { ok?: string; error?: string; email?: string };

// Trang Sửa hồ sơ: tên hiển thị + giới thiệu (SPEC-social.md bổ sung 30/10, A2).
export async function updateProfileAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const result = await updateProfile(user.id, {
    displayName: String(form.get('displayName') ?? ''),
    bio: String(form.get('bio') ?? ''),
  });
  if (!result.ok)
    return {
      error:
        result.error === 'INVALID_INPUT' ? t('auth.err.displayName') : t(`profile.edit.err.${result.error}`),
    };
  revalidatePath('/tai-khoan', 'layout');
  revalidatePath(`/creator/${user.id}`);
  return { ok: t('profile.edit.saved') };
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

// Đặt mật khẩu mới không cần mật khẩu cũ (CEO chốt 29/10): mã gửi về email của chính tài khoản, không cho nhập email khác.
export async function sendSetPasswordCodeAction(): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  if (!user.email) return { error: t('me.settings.setPasswordNoEmail') };
  const r = await requestEmailOtp({
    email: user.email,
    purpose: 'set-password',
    ip: (await headers()).get('x-real-ip') ?? '0.0.0.0',
  });
  return r.ok
    ? { ok: t('me.settings.codeSent', { email: user.email }) }
    : { error: t(`auth.otp.err.${r.error}`) };
}

export async function setPasswordAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  const newPassword = String(form.get('newPassword') ?? '');
  if (newPassword !== String(form.get('confirm') ?? '')) return { error: t('me.settings.mismatch') };
  const r = await setPasswordWithOtp(user.id, (await getCurrentSessionId())!, {
    code: String(form.get('code') ?? ''),
    newPassword,
  });
  if (r.ok) {
    revalidatePath('/tai-khoan', 'layout');
    return { ok: t('me.settings.setPasswordSaved') };
  }
  if (r.error === 'INVALID_PASSWORD') return { error: t('me.settings.passwordLength') };
  if (r.error === 'NO_EMAIL') return { error: t('me.settings.setPasswordNoEmail') };
  return { error: t(`auth.otp.err.${r.error}`) };
}

// Đổi @tên (SPEC-identity.md V5.1): 30 ngày một lần.
export async function setHandleAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const t = await getT();
  if (!(await isFeatureOn('account_more'))) return { error: t('me.settings.handleErr.INVALID') };
  const result = await setHandle(user.id, String(form.get('handle') ?? '').toLowerCase());
  if (!result.ok) return { error: t(`me.settings.handleErr.${result.error}`) };
  revalidatePath('/tai-khoan', 'layout');
  return { ok: t('me.settings.handleSaved') };
}
