'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { GOOGLE_LINK_COOKIE, googleCookieOptions } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import { linkGoogleWithTicket, login, startSession } from '@/modules/identity';

export type LoginFormState = { identifier?: string; message?: string };

const MESSAGES = {
  INVALID_CREDENTIALS: 'auth.err.invalid',
  TOO_MANY_ATTEMPTS: 'auth.err.tooMany',
  ACCOUNT_LOCKED: 'auth.err.locked',
} as const;

export async function loginAction(_prev: LoginFormState, form: FormData): Promise<LoginFormState> {
  const identifier = String(form.get('identifier') ?? '');
  const result = await login({ identifier, password: String(form.get('password') ?? '') });
  if (!result.ok) return { identifier, message: (await getT())(MESSAGES[result.error]) };

  await startSession(result.userId);
  // Vừa bị yêu cầu đăng nhập mật khẩu để liên kết Google (email trùng): liên kết ngay nếu vé còn hạn.
  const jar = await cookies();
  const ticket = jar.get(GOOGLE_LINK_COOKIE)?.value;
  if (ticket) {
    await linkGoogleWithTicket(result.userId, ticket);
    jar.set(GOOGLE_LINK_COOKIE, '', { ...googleCookieOptions(), maxAge: 0 });
  }
  redirect(result.mustChangePassword ? '/tai-khoan/cai-dat?doi-mat-khau=1' : safeNextPath(form.get('next')));
}
