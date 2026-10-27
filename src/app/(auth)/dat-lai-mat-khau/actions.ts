'use server';

import { getT } from '@/i18n/server';
import { completePasswordReset } from '@/modules/identity';

export type ResetFormState = { error?: string; done?: boolean };

export async function resetPasswordAction(_prev: ResetFormState, form: FormData): Promise<ResetFormState> {
  const t = await getT();
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('confirm') ?? '')) return { error: t('auth.reset.mismatch') };

  const result = await completePasswordReset(String(form.get('token') ?? ''), password);
  if (!result.ok) {
    return { error: t(result.error === 'INVALID_PASSWORD' ? 'auth.err.password' : 'auth.reset.expired') };
  }
  // Trình duyệt tự chuyển trang (ResetForm): redirect() của Server Action đôi khi làm router Next.js đứng yên ở nút
  // "Đang lưu…" dù máy chủ đã xong (E2E 27/10).
  return { done: true };
}
