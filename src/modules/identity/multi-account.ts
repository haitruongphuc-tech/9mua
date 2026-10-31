import { cookies } from 'next/headers';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { SESSION_COOKIE, sessionCookieOptions } from './cookie';
import { invalidateSession, validateSessionToken } from './session';

// Nhiều tài khoản trên một máy (SPEC-identity.md V5.5): tối đa 3 tài khoản. Phiên đang dùng nằm ở cookie phiên như cũ;
// phiên của các tài khoản khác nằm trong một cookie httpOnly mã hoá (mỗi phiên vẫn là một dòng Session riêng, hạn 30 ngày
// như cũ). Chuyển tài khoản = đổi chỗ hai token, không cần nhập lại mật khẩu. Tài khoản admin không vào danh sách.
export const MAX_ACCOUNTS = 3;
export const SAVED_COOKIE = 'ninemua_accounts';
const COOKIE_MAX_AGE = 400 * 86_400;

export type SavedAccount = { userId: string; displayName: string; avatarUrl: string | null };

async function readSaved(): Promise<string[]> {
  const raw = (await cookies()).get(SAVED_COOKIE)?.value;
  if (!raw) return [];
  try {
    const list = JSON.parse(decryptSecret(raw)) as unknown;
    return Array.isArray(list)
      ? list.filter((t): t is string => typeof t === 'string').slice(0, MAX_ACCOUNTS - 1)
      : [];
  } catch {
    return [];
  }
}

async function writeSaved(tokens: string[]): Promise<void> {
  const jar = await cookies();
  const options = sessionCookieOptions(env().APP_URL);
  if (!tokens.length) jar.set(SAVED_COOKIE, '', { ...options, maxAge: 0 });
  else jar.set(SAVED_COOKIE, encryptSecret(JSON.stringify(tokens)), { ...options, maxAge: COOKIE_MAX_AGE });
}

// Phiên còn hạn, không phải admin. Token hết hạn / bị khoá thì bỏ khỏi danh sách.
async function liveTokens(): Promise<{ token: string; userId: string }[]> {
  const out: { token: string; userId: string }[] = [];
  for (const token of await readSaved()) {
    const s = await validateSessionToken(token);
    if (s && s.user.role !== 'admin' && !out.some((o) => o.userId === s.user.id))
      out.push({ token, userId: s.user.id });
  }
  return out;
}

// Các tài khoản khác đã lưu trên máy này (không gồm tài khoản đang dùng).
export async function savedAccounts(currentUserId?: string): Promise<SavedAccount[]> {
  const live = (await liveTokens()).filter((t) => t.userId !== currentUserId);
  if (!live.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: live.map((t) => t.userId) } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  return live.flatMap((t) => {
    const u = users.find((x) => x.id === t.userId);
    return u ? [{ userId: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }] : [];
  });
}

// "Thêm tài khoản": cất phiên đang dùng vào danh sách rồi bỏ cookie phiên (không huỷ phiên) để đăng nhập tài khoản khác.
export async function stashCurrentAccount(): Promise<
  { ok: true } | { ok: false; error: 'ADMIN' | 'FULL' | 'NO_SESSION' }
> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const s = token ? await validateSessionToken(token) : null;
  if (!token || !s) return { ok: false, error: 'NO_SESSION' };
  if (s.user.role === 'admin') return { ok: false, error: 'ADMIN' };
  const live = (await liveTokens()).filter((t) => t.userId !== s.user.id);
  if (live.length + 1 >= MAX_ACCOUNTS) return { ok: false, error: 'FULL' };
  await writeSaved([token, ...live.map((t) => t.token)]);
  jar.set(SESSION_COOKIE, '', { ...sessionCookieOptions(env().APP_URL), maxAge: 0 });
  return { ok: true };
}

// Chuyển sang tài khoản đã lưu: đổi chỗ token đang dùng với token đã lưu.
export async function switchAccount(userId: string): Promise<boolean> {
  const jar = await cookies();
  const live = await liveTokens();
  const target = live.find((t) => t.userId === userId);
  if (!target) return false;
  const current = jar.get(SESSION_COOKIE)?.value;
  const cs = current ? await validateSessionToken(current) : null;
  const rest = live.filter((t) => t.userId !== userId && t.userId !== cs?.user.id).map((t) => t.token);
  const keep = cs && cs.user.role !== 'admin' && current ? [current] : [];
  await writeSaved([...keep, ...rest].slice(0, MAX_ACCOUNTS - 1));
  jar.set(SESSION_COOKIE, target.token, { ...sessionCookieOptions(env().APP_URL), maxAge: COOKIE_MAX_AGE });
  return true;
}

// Sau khi đăng xuất tài khoản đang dùng: chuyển sang tài khoản đã lưu đầu tiên (nếu có). Trả userId đã chuyển sang.
export async function switchToNextSaved(): Promise<string | null> {
  const first = (await liveTokens())[0];
  if (!first) {
    await writeSaved([]);
    return null;
  }
  return (await switchAccount(first.userId)) ? first.userId : null;
}

// Đăng xuất tất cả tài khoản trên máy này.
export async function endAllSavedSessions(): Promise<void> {
  for (const token of await readSaved()) await invalidateSession(token);
  await writeSaved([]);
}
