import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { clearOutbox, getOutbox } from '@/lib/mail';
import { login } from './login';
import { register } from './register';
import { createSession, validateSessionToken } from './session';
import { completePasswordReset, requestPasswordReset } from './reset';

const email = 'hai@9mua.com';

async function setup() {
  const r = await register({ identifier: email, displayName: 'Nguyễn Hải', password: 'mat-khau-cu-1' });
  if (!r.ok) throw new Error('setup');
  return r.userId;
}

function tokenFromMail(): string {
  const mail = getOutbox().at(-1);
  const match = mail?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error('Không thấy link trong email');
  return match[1];
}

describe('quên mật khẩu', () => {
  it('gửi email có link, DB chỉ lưu mã băm', async () => {
    await setup();
    await requestPasswordReset(' HAI@9mua.com ');
    expect(getOutbox()).toHaveLength(1);
    expect(getOutbox()[0]?.to).toBe(email);
    const token = tokenFromMail();
    const row = await db.passwordResetToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(token);
  });

  it('email chưa đăng ký: không gửi gì nhưng vẫn trả kết quả như thường', async () => {
    const known = await (async () => {
      await setup();
      return requestPasswordReset(email);
    })();
    clearOutbox();
    const unknown = await requestPasswordReset('khong-co@9mua.com');
    expect(unknown).toEqual(known);
    expect(getOutbox()).toHaveLength(0);
  });

  it('đặt lại thành công: đổi mật khẩu, huỷ mọi phiên', async () => {
    const userId = await setup();
    const { token: sessionToken } = await createSession(userId);
    await requestPasswordReset(email);
    expect(await completePasswordReset(tokenFromMail(), 'mat-khau-moi-2')).toEqual({ ok: true });
    expect(await validateSessionToken(sessionToken)).toBeNull();
    expect(await login({ identifier: email, password: 'mat-khau-moi-2' })).toMatchObject({ ok: true });
    expect(await login({ identifier: email, password: 'mat-khau-cu-1' })).toMatchObject({ ok: false });
  });

  it('link chỉ dùng được 1 lần, kể cả khi bấm 2 lần cùng lúc', async () => {
    await setup();
    await requestPasswordReset(email);
    const token = tokenFromMail();
    const results = await Promise.all([
      completePasswordReset(token, 'mat-khau-moi-2'),
      completePasswordReset(token, 'mat-khau-moi-3'),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await completePasswordReset(token, 'mat-khau-moi-4')).toEqual({
      ok: false,
      error: 'INVALID_TOKEN',
    });
  });

  it('hết hạn sau 30 phút', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    await setup();
    await requestPasswordReset(email);
    advanceClock({ minutes: 30, seconds: 1 });
    expect(await completePasswordReset(tokenFromMail(), 'mat-khau-moi-2')).toEqual({
      ok: false,
      error: 'INVALID_TOKEN',
    });
  });

  it('đặt lại xong thì các link cũ khác cũng mất hiệu lực', async () => {
    await setup();
    await requestPasswordReset(email);
    const first = tokenFromMail();
    await requestPasswordReset(email);
    const second = tokenFromMail();
    expect(await completePasswordReset(second, 'mat-khau-moi-2')).toEqual({ ok: true });
    expect(await completePasswordReset(first, 'mat-khau-moi-3')).toEqual({
      ok: false,
      error: 'INVALID_TOKEN',
    });
  });

  it('tối đa 3 email mỗi giờ cho một địa chỉ', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    await setup();
    for (let i = 0; i < 5; i++) await requestPasswordReset(email);
    expect(getOutbox()).toHaveLength(3);
    advanceClock({ hours: 1, seconds: 1 });
    await requestPasswordReset(email);
    expect(getOutbox()).toHaveLength(4);
  });

  it('mật khẩu mới quá ngắn bị từ chối và link vẫn còn dùng được', async () => {
    await setup();
    await requestPasswordReset(email);
    const token = tokenFromMail();
    expect(await completePasswordReset(token, 'ngan')).toEqual({ ok: false, error: 'INVALID_PASSWORD' });
    expect(await completePasswordReset(token, 'mat-khau-moi-2')).toEqual({ ok: true });
  });

  it('đặt lại mật khẩu chỉ mở khoá đăng nhập của chính tài khoản đó', async () => {
    await setup();
    await register({ identifier: '0979393916', displayName: 'Người khác', password: 'mat-khau-khac' });
    for (let i = 0; i < 5; i++) await login({ identifier: '0979393916', password: 'sai' });
    for (let i = 0; i < 5; i++) await login({ identifier: email, password: 'sai' });
    await requestPasswordReset(email);
    expect(await completePasswordReset(tokenFromMail(), 'mat-khau-moi-2')).toEqual({ ok: true });
    expect(await login({ identifier: email, password: 'mat-khau-moi-2' })).toMatchObject({ ok: true });
    expect(await login({ identifier: '0979393916', password: 'mat-khau-khac' })).toEqual({
      ok: false,
      error: 'TOO_MANY_ATTEMPTS',
    });
  });

  it('tài khoản bị khoá không nhận email đặt lại', async () => {
    const userId = await setup();
    await db.user.update({ where: { id: userId }, data: { lockedAt: new Date() } });
    await requestPasswordReset(email);
    expect(getOutbox()).toHaveLength(0);
  });
});
