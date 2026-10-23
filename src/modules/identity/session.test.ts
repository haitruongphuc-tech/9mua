import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createSession, invalidateAllSessions, invalidateSession, validateSessionToken } from './session';
import { register } from './register';

async function newUser(identifier = '0979393916') {
  const r = await register({ identifier, displayName: 'Nguyễn Hải', password: 'matkhau-9mua' });
  if (!r.ok) throw new Error('setup');
  return r.userId;
}

describe('session', () => {
  it('chỉ lưu mã băm SHA-256 của token', async () => {
    const userId = await newUser();
    const { token } = await createSession(userId);
    const row = await db.session.findFirstOrThrow();
    expect(row.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.tokenHash).not.toContain(token);
  });

  it('xác thực token hợp lệ và trả thông tin người dùng', async () => {
    const userId = await newUser();
    const { token } = await createSession(userId);
    const result = await validateSessionToken(token);
    expect(result?.user).toMatchObject({
      id: userId,
      displayName: 'Nguyễn Hải',
      role: 'user',
      phone: '+84979393916',
    });
  });

  it('token sai hoặc rỗng trả null', async () => {
    expect(await validateSessionToken('khong-ton-tai')).toBeNull();
    expect(await validateSessionToken('')).toBeNull();
  });

  it('hết hạn sau 30 ngày không dùng', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { token } = await createSession(await newUser());
    advanceClock({ days: 30, seconds: 1 });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it('tự gia hạn khi đang dùng', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { token } = await createSession(await newUser());
    advanceClock({ days: 20 });
    expect(await validateSessionToken(token)).not.toBeNull();
    advanceClock({ days: 20 });
    const result = await validateSessionToken(token);
    expect(result).not.toBeNull();
    expect(result?.renewed).toBe(true);
  });

  it('tài khoản bị khoá thì phiên mất hiệu lực', async () => {
    const userId = await newUser();
    const { token } = await createSession(userId);
    await db.user.update({ where: { id: userId }, data: { lockedAt: new Date() } });
    expect(await validateSessionToken(token)).toBeNull();
  });

  it('đăng xuất một phiên và đăng xuất mọi thiết bị trừ phiên hiện tại', async () => {
    const userId = await newUser();
    const a = await createSession(userId);
    const b = await createSession(userId);
    const c = await createSession(userId);
    await invalidateSession(a.token);
    expect(await validateSessionToken(a.token)).toBeNull();
    await invalidateAllSessions(userId, { except: b.sessionId });
    expect(await validateSessionToken(b.token)).not.toBeNull();
    expect(await validateSessionToken(c.token)).toBeNull();
  });
});
