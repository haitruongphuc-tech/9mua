import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { login } from './login';
import { register } from './register';

const password = 'matkhau-9mua';

async function setup() {
  const r = await register({ identifier: '0979393916', displayName: 'Nguyễn Hải', password });
  if (!r.ok) throw new Error('setup');
  return r.userId;
}

describe('login', () => {
  it('đăng nhập bằng mọi cách viết SĐT', async () => {
    const userId = await setup();
    expect(await login({ identifier: '+84 979 393 916', password })).toEqual({ ok: true, userId });
  });

  it('sai mật khẩu và tài khoản không tồn tại trả cùng một lỗi', async () => {
    await setup();
    const wrong = await login({ identifier: '0979393916', password: 'sai-mat-khau' });
    const unknown = await login({ identifier: '0909000000', password });
    expect(wrong).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
    expect(unknown).toEqual(wrong);
  });

  it('lần thứ 6 trong 15 phút bị chặn kể cả khi đúng mật khẩu', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    await setup();
    for (let i = 0; i < 5; i++) await login({ identifier: '0979393916', password: 'sai' });
    expect(await login({ identifier: '0979 393 916', password })).toEqual({
      ok: false,
      error: 'TOO_MANY_ATTEMPTS',
    });
  });

  it('mở lại sau 15 phút', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const userId = await setup();
    for (let i = 0; i < 5; i++) await login({ identifier: '0979393916', password: 'sai' });
    advanceClock({ minutes: 15, seconds: 1 });
    expect(await login({ identifier: '0979393916', password })).toEqual({ ok: true, userId });
  });

  it('khoá theo định danh, không ảnh hưởng tài khoản khác', async () => {
    await setup();
    const other = await register({ identifier: 'b@9mua.com', displayName: 'B B', password });
    for (let i = 0; i < 5; i++) await login({ identifier: '0979393916', password: 'sai' });
    expect(await login({ identifier: 'b@9mua.com', password })).toMatchObject({ ok: true });
    expect(other.ok).toBe(true);
  });

  it('tài khoản bị khoá không đăng nhập được', async () => {
    const userId = await setup();
    await db.user.update({ where: { id: userId }, data: { lockedAt: new Date() } });
    expect(await login({ identifier: '0979393916', password })).toEqual({
      ok: false,
      error: 'ACCOUNT_LOCKED',
    });
  });

  it('không ghi mật khẩu vào bảng lần thử', async () => {
    await setup();
    await login({ identifier: '0979393916', password: 'bi-mat-sai' });
    const rows = await db.loginAttempt.findMany();
    expect(JSON.stringify(rows)).not.toContain('bi-mat-sai');
  });
});
