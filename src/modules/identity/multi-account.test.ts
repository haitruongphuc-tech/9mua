import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { createUser } from '../../../tests/helpers/factories';

// Hộp cookie trong bộ nhớ thay cho next/headers (chạy ngoài Next).
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string, opts?: { maxAge?: number }) => {
      if (opts?.maxAge === 0 || value === '') jar.delete(name);
      else jar.set(name, value);
    },
    has: (name: string) => jar.has(name),
  }),
  headers: async () => new Headers(),
}));

const { SESSION_COOKIE } = await import('./cookie');
const { createSession, validateSessionToken } = await import('./session');
const { endAllSavedSessions, savedAccounts, stashCurrentAccount, switchAccount, switchToNextSaved } =
  await import('./multi-account');

async function loginAs(userId: string) {
  jar.set(SESSION_COOKIE, (await createSession(userId)).token);
}
const currentUserId = async () =>
  (await validateSessionToken(jar.get(SESSION_COOKIE) ?? ''))?.user.id ?? null;

describe('nhiều tài khoản trên một máy (SPEC-identity.md V5.5)', () => {
  beforeEach(() => jar.clear());

  it('thêm tài khoản, chuyển qua lại không cần mật khẩu, tối đa 3, đăng xuất tất cả', async () => {
    const [a, b, c, d] = [await createUser(), await createUser(), await createUser(), await createUser()];
    await loginAs(a.id);
    expect(await stashCurrentAccount()).toEqual({ ok: true });
    expect(await currentUserId()).toBeNull();
    await loginAs(b.id);
    expect((await savedAccounts(b.id)).map((x) => x.userId)).toEqual([a.id]);

    expect(await switchAccount(a.id)).toBe(true);
    expect(await currentUserId()).toBe(a.id);
    expect((await savedAccounts(a.id)).map((x) => x.userId)).toEqual([b.id]);

    expect(await stashCurrentAccount()).toEqual({ ok: true });
    await loginAs(c.id);
    expect((await savedAccounts(c.id)).map((x) => x.userId).sort()).toEqual([a.id, b.id].sort());
    expect(await stashCurrentAccount()).toEqual({ ok: false, error: 'FULL' });
    expect(await currentUserId()).toBe(c.id);
    expect(await switchAccount(d.id)).toBe(false);

    // Đăng xuất tài khoản đang dùng → tự chuyển sang tài khoản đã lưu.
    jar.delete(SESSION_COOKIE);
    expect([a.id, b.id]).toContain(await switchToNextSaved());

    const saved = (await savedAccounts()).map((x) => x.userId);
    expect(saved).toHaveLength(1);
    await endAllSavedSessions();
    expect(await savedAccounts()).toEqual([]);
    expect(await db.session.count({ where: { userId: saved[0] } })).toBe(0);
  });

  it('tài khoản admin không vào danh sách', async () => {
    const admin = await createUser();
    await db.user.update({ where: { id: admin.id }, data: { role: 'admin' } });
    await loginAs(admin.id);
    expect(await stashCurrentAccount()).toEqual({ ok: false, error: 'ADMIN' });
  });
});
