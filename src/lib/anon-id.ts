import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

// Mã ẩn danh để đếm lượt xem của người chưa đăng nhập (1 lượt mỗi video mỗi ngày). Không chứa thông tin cá nhân.
export const ANON_COOKIE = 'nm_anon';

export async function readAnonId(): Promise<string | undefined> {
  return (await cookies()).get(ANON_COOKIE)?.value;
}

export async function ensureAnonId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = randomBytes(18).toString('base64url');
  jar.set(ANON_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !process.env.TEST_MODE,
    path: '/',
    maxAge: 365 * 86_400,
  });
  return id;
}
