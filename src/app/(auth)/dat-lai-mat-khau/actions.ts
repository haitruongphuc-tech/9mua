'use server';

import { redirect } from 'next/navigation';
import { completePasswordReset } from '@/modules/identity';

export type ResetFormState = { error?: string };

export async function resetPasswordAction(_prev: ResetFormState, form: FormData): Promise<ResetFormState> {
  const password = String(form.get('password') ?? '');
  if (password !== String(form.get('confirm') ?? '')) return { error: 'Hai mật khẩu không khớp.' };

  const result = await completePasswordReset(String(form.get('token') ?? ''), password);
  if (!result.ok) {
    return {
      error:
        result.error === 'INVALID_PASSWORD'
          ? 'Mật khẩu cần từ 8 đến 128 ký tự.'
          : 'Link đã hết hạn hoặc đã được dùng. Hãy yêu cầu link mới.',
    };
  }
  redirect('/dang-nhap?da-dat-lai=1');
}
