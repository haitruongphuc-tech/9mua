import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { env } from '@/lib/env';
import { SESSION_COOKIE, sessionCookieOptions } from './cookie';
import { createSession, invalidateSession, validateSessionToken } from './session';
import type { SessionUser } from './types';

// Cookie sống tối đa 400 ngày (giới hạn trình duyệt); hạn thật do bảng Session quyết định
// nên gia hạn trượt chỉ cần cập nhật DB, không phải ghi lại cookie trong Server Component.
const COOKIE_MAX_AGE = 400 * 86_400;

const readSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? validateSessionToken(token) : null;
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await readSession())?.user ?? null;
}

export async function getCurrentSessionId(): Promise<string | null> {
  return (await readSession())?.sessionId ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get('x-pathname') ?? '/';
    redirect(`/dang-nhap?next=${encodeURIComponent(path)}`);
  }
  return user;
}

// Chỉ gọi trong Server Action / Route Handler (nơi được phép ghi cookie).
export async function startSession(userId: string): Promise<void> {
  const { token } = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    ...sessionCookieOptions(env().APP_URL),
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  jar.set(SESSION_COOKIE, '', { ...sessionCookieOptions(env().APP_URL), maxAge: 0 });
}
