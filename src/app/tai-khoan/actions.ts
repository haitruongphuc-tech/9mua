'use server';

import { revalidatePath } from 'next/cache';
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
  const result = await updateProfile(user.id, { displayName: String(form.get('displayName') ?? '') });
  if (!result.ok) return { error: result.message };
  revalidatePath('/tai-khoan');
  return { ok: 'Đã lưu tên hiển thị.' };
}

const EMAIL_ERRORS = {
  WRONG_PASSWORD: 'Mật khẩu không đúng.',
  INVALID_EMAIL: 'Email không hợp lệ.',
  EMAIL_TAKEN: 'Email này đã được tài khoản khác sử dụng.',
} as const;

export async function changeEmailAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const email = String(form.get('email') ?? '');
  const result = await changeEmail(user.id, { email, password: String(form.get('password') ?? '') });
  if (!result.ok) return { error: EMAIL_ERRORS[result.error], email };
  revalidatePath('/tai-khoan');
  return { ok: 'Đã lưu email. Bạn có thể dùng email này để đăng nhập và lấy lại mật khẩu.' };
}

export async function changePasswordAction(_p: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const sessionId = await getCurrentSessionId();
  const newPassword = String(form.get('newPassword') ?? '');
  if (newPassword !== String(form.get('confirm') ?? '')) return { error: 'Hai mật khẩu mới không khớp.' };
  const result = await changePassword(user.id, sessionId!, {
    oldPassword: String(form.get('oldPassword') ?? ''),
    newPassword,
  });
  if (!result.ok) {
    return {
      error:
        result.error === 'WRONG_PASSWORD' ? 'Mật khẩu hiện tại không đúng.' : 'Mật khẩu mới cần 8–128 ký tự.',
    };
  }
  revalidatePath('/tai-khoan');
  return { ok: 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.' };
}
