import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { login } from './login';
import { register } from './register';
import { createSession, validateSessionToken } from './session';
import { changeEmail, changePassword, updateProfile } from './account';
import { createAdmin, lockUser, resetPassword, unlockUser } from './admin';

const password = 'matkhau-9mua';

async function setup(identifier = '0979393916') {
  const r = await register({ identifier, displayName: 'Nguyễn Hải', password });
  if (!r.ok) throw new Error('setup');
  return r.userId;
}

describe('tài khoản', () => {
  it('đổi tên hiển thị', async () => {
    const userId = await setup();
    expect(await updateProfile(userId, { displayName: '  Hải 9MUA ' })).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).displayName).toBe('Hải 9MUA');
    expect(await updateProfile(userId, { displayName: 'H' })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
    });
  });

  it('thêm email cần đúng mật khẩu, email phải chưa có người dùng', async () => {
    const userId = await setup();
    await setup('taken@9mua.com');
    expect(await changeEmail(userId, { email: 'hai@9mua.com', password: 'sai' })).toEqual({
      ok: false,
      error: 'WRONG_PASSWORD',
    });
    expect(await changeEmail(userId, { email: 'TAKEN@9mua.com', password })).toEqual({
      ok: false,
      error: 'EMAIL_TAKEN',
    });
    expect(await changeEmail(userId, { email: 'khong-hop-le', password })).toEqual({
      ok: false,
      error: 'INVALID_EMAIL',
    });
    expect(await changeEmail(userId, { email: 'Hai@9mua.com', password })).toEqual({ ok: true });
    expect(await login({ identifier: 'hai@9mua.com', password })).toMatchObject({ ok: true });
  });

  it('đổi mật khẩu: cần mật khẩu cũ, huỷ phiên khác, giữ phiên hiện tại', async () => {
    const userId = await setup();
    const current = await createSession(userId);
    const other = await createSession(userId);
    expect(
      await changePassword(userId, current.sessionId, { oldPassword: 'sai', newPassword: 'moi-12345' }),
    ).toEqual({
      ok: false,
      error: 'WRONG_PASSWORD',
    });
    expect(
      await changePassword(userId, current.sessionId, { oldPassword: password, newPassword: 'ngan' }),
    ).toEqual({
      ok: false,
      error: 'INVALID_PASSWORD',
    });
    expect(
      await changePassword(userId, current.sessionId, { oldPassword: password, newPassword: 'moi-12345' }),
    ).toEqual({
      ok: true,
    });
    expect(await validateSessionToken(current.token)).not.toBeNull();
    expect(await validateSessionToken(other.token)).toBeNull();
    expect(await login({ identifier: '0979393916', password: 'moi-12345' })).toMatchObject({ ok: true });
  });
});

describe('quản trị tài khoản', () => {
  it('khoá tài khoản: huỷ mọi phiên và không đăng nhập được; mở khoá thì đăng nhập lại được', async () => {
    const userId = await setup();
    const s = await createSession(userId);
    await lockUser(userId);
    expect(await validateSessionToken(s.token)).toBeNull();
    expect(await login({ identifier: '0979393916', password })).toEqual({
      ok: false,
      error: 'ACCOUNT_LOCKED',
    });
    await unlockUser(userId);
    expect(await login({ identifier: '0979393916', password })).toMatchObject({ ok: true });
  });

  it('cấp mật khẩu tạm: đăng nhập được bằng mật khẩu tạm và bị buộc đổi', async () => {
    const userId = await setup();
    const s = await createSession(userId);
    const { tempPassword } = await resetPassword(userId);
    expect(tempPassword).toMatch(/^[A-Za-z0-9]{10,}$/);
    expect(await validateSessionToken(s.token)).toBeNull();
    expect(await login({ identifier: '0979393916', password: tempPassword })).toMatchObject({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).mustChangePassword).toBe(true);
  });

  it('đổi mật khẩu xong thì hết bị buộc đổi', async () => {
    const userId = await setup();
    const { tempPassword } = await resetPassword(userId);
    const s = await createSession(userId);
    await changePassword(userId, s.sessionId, { oldPassword: tempPassword, newPassword: 'moi-12345' });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).mustChangePassword).toBe(false);
  });

  it('tạo CEO mới với vai trò admin', async () => {
    const result = await createAdmin({ identifier: '0979393916', displayName: 'Nguyễn Hải', password });
    expect(result).toMatchObject({ ok: true, created: true });
    expect((await db.user.findFirstOrThrow()).role).toBe('admin');
  });

  it('tài khoản đã có thì chỉ nâng quyền, không đổi mật khẩu', async () => {
    const userId = await setup();
    const result = await createAdmin({
      identifier: '+84979393916',
      displayName: 'X',
      password: 'khac-hoan-toan',
    });
    expect(result).toEqual({ ok: true, created: false, userId });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe('admin');
    expect(await login({ identifier: '0979393916', password })).toMatchObject({ ok: true });
  });
});
