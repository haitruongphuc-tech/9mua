'use server';

import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { login, startSession } from '@/modules/identity';

export type LoginFormState = { identifier?: string; message?: string };

const MESSAGES = {
  INVALID_CREDENTIALS: 'Sai tài khoản hoặc mật khẩu.',
  TOO_MANY_ATTEMPTS: 'Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  ACCOUNT_LOCKED: 'Tài khoản đã bị khoá. Vui lòng liên hệ 9MUA.',
} as const;

export async function loginAction(_prev: LoginFormState, form: FormData): Promise<LoginFormState> {
  const identifier = String(form.get('identifier') ?? '');
  const result = await login({ identifier, password: String(form.get('password') ?? '') });
  if (!result.ok) return { identifier, message: MESSAGES[result.error] };

  await startSession(result.userId);
  redirect(safeNextPath(form.get('next')));
}
