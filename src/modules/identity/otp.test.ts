import { describe, expect, it } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { clearOutbox, getOutbox } from '@/lib/mail';
import { completeGoogleLogin } from './google';
import { sealLinkTicket } from './link';
import { login } from './login';
import { addEmailWithOtp, linkWithOtp, loginWithEmailOtp, requestEmailOtp, setPasswordWithOtp } from './otp';
import { createSession } from './session';
import { register } from './register';

const IP = '203.0.113.7';

function codeFromMail(to: string): string {
  const mail = [...getOutbox()].reverse().find((m) => m.to === to);
  const match = mail?.text.match(/\b(\d{6})\b/);
  if (!match?.[1]) throw new Error('Không thấy mã trong email');
  return match[1];
}

async function sendCode(email: string, purpose: 'login' | 'link' | 'add-email' | 'set-password' = 'login') {
  const r = await requestEmailOtp({ email, purpose, ip: IP });
  expect(r).toEqual({ ok: true });
  return codeFromMail(email.trim().toLowerCase());
}

describe('mã email (SPEC-identity.md bổ sung 29/10)', () => {
  it('email mới: gửi mã 6 số, nhập đúng thì tạo tài khoản; DB chỉ lưu mã băm; mã dùng 1 lần', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    clearOutbox();
    const code = await sendCode(' Moi@9Mua.vn ');
    const row = await db.emailOtp.findFirstOrThrow({ where: { email: 'moi@9mua.vn' } });
    expect(row.codeHash).not.toContain(code);
    expect(row.ipHash).not.toContain(IP);
    const r = await loginWithEmailOtp({ email: 'moi@9mua.vn', code, displayName: 'Chị Mới' });
    expect(r).toMatchObject({ ok: true, created: true });
    const user = await db.user.findUniqueOrThrow({ where: { email: 'moi@9mua.vn' } });
    expect(user.displayName).toBe('Chị Mới');
    expect(await loginWithEmailOtp({ email: 'moi@9mua.vn', code })).toEqual({
      ok: false,
      error: 'CODE_EXPIRED',
    });
  });

  it('email đã có tài khoản: đăng nhập đúng tài khoản đó; không có tên thì lấy phần trước @', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const old = await register({ identifier: 'cu@9mua.vn', displayName: 'Anh Cũ', password: 'matkhau-9mua' });
    if (!old.ok) throw new Error('setup');
    const r = await loginWithEmailOtp({ email: 'cu@9mua.vn', code: await sendCode('cu@9mua.vn') });
    expect(r).toEqual({ ok: true, userId: old.userId, created: false });
    const fresh = await loginWithEmailOtp({
      email: 'ten.tam@9mua.vn',
      code: await sendCode('ten.tam@9mua.vn'),
    });
    expect(fresh.ok && (await db.user.findUniqueOrThrow({ where: { id: fresh.userId } })).displayName).toBe(
      'ten.tam',
    );
  });

  it('gửi lại sau 60 giây; mỗi email tối đa 5 mã/giờ; mỗi IP tối đa 20 mã/giờ; email sai bị từ chối', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    expect(await requestEmailOtp({ email: 'khong-phai-email', purpose: 'login', ip: IP })).toEqual({
      ok: false,
      error: 'INVALID_EMAIL',
    });
    await sendCode('nhieu@9mua.vn');
    expect(await requestEmailOtp({ email: 'nhieu@9mua.vn', purpose: 'login', ip: IP })).toEqual({
      ok: false,
      error: 'TOO_SOON',
    });
    for (let i = 0; i < 4; i++) {
      advanceClock({ seconds: 61 });
      await sendCode('nhieu@9mua.vn');
    }
    advanceClock({ seconds: 61 });
    expect(await requestEmailOtp({ email: 'nhieu@9mua.vn', purpose: 'login', ip: IP })).toEqual({
      ok: false,
      error: 'TOO_MANY',
    });
    const ip = '198.51.100.9';
    for (let i = 0; i < 20; i++)
      expect((await requestEmailOtp({ email: `ip${i}@9mua.vn`, purpose: 'login', ip })).ok).toBe(true);
    expect(await requestEmailOtp({ email: 'ip-cuoi@9mua.vn', purpose: 'login', ip })).toEqual({
      ok: false,
      error: 'TOO_MANY',
    });
    // Không biết IP thật (không qua Nginx): không gộp mọi người vào chung một giới hạn; giới hạn theo email vẫn còn.
    for (let i = 0; i < 21; i++)
      expect(
        (await requestEmailOtp({ email: `khong-ip${i}@9mua.vn`, purpose: 'login', ip: '0.0.0.0' })).ok,
      ).toBe(true);
  });

  it('sai 5 lần thì mã hỏng; mã hết hạn sau 10 phút; chỉ mã mới nhất dùng được', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const code = await sendCode('sai@9mua.vn');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      expect(await loginWithEmailOtp({ email: 'sai@9mua.vn', code: wrong })).toEqual({
        ok: false,
        error: 'CODE_INVALID',
      });
    expect(await loginWithEmailOtp({ email: 'sai@9mua.vn', code })).toEqual({
      ok: false,
      error: 'CODE_EXPIRED',
    });

    advanceClock({ seconds: 61 });
    const late = await sendCode('sai@9mua.vn');
    advanceClock({ minutes: 11 });
    expect(await loginWithEmailOtp({ email: 'sai@9mua.vn', code: late })).toEqual({
      ok: false,
      error: 'CODE_EXPIRED',
    });

    const first = await sendCode('sai@9mua.vn');
    advanceClock({ seconds: 61 });
    const second = await sendCode('sai@9mua.vn');
    if (first !== second)
      expect(await loginWithEmailOtp({ email: 'sai@9mua.vn', code: first })).toMatchObject({ ok: false });
    expect((await loginWithEmailOtp({ email: 'sai@9mua.vn', code: second })).ok).toBe(true);
  });

  it('admin và tài khoản bị khoá không đăng nhập bằng mã', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const admin = await register({ identifier: 'sep@9mua.vn', displayName: 'CEO', password: 'matkhau-9mua' });
    const locked = await register({
      identifier: 'khoa@9mua.vn',
      displayName: 'Khoá',
      password: 'matkhau-9mua',
    });
    if (!admin.ok || !locked.ok) throw new Error('setup');
    await db.user.update({ where: { id: admin.userId }, data: { role: 'admin' } });
    await db.user.update({ where: { id: locked.userId }, data: { lockedAt: new Date() } });
    expect(await loginWithEmailOtp({ email: 'sep@9mua.vn', code: await sendCode('sep@9mua.vn') })).toEqual({
      ok: false,
      error: 'ADMIN',
    });
    expect(await loginWithEmailOtp({ email: 'khoa@9mua.vn', code: await sendCode('khoa@9mua.vn') })).toEqual({
      ok: false,
      error: 'LOCKED',
    });
  });

  it('mã của mục đích khác không dùng được (mã đăng nhập không thêm được email)', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const u = await db.user.create({ data: { displayName: 'Zalo', passwordHash: 'x' } });
    const code = await sendCode('them@9mua.vn', 'login');
    expect(await addEmailWithOtp(u.id, { email: 'them@9mua.vn', code })).toEqual({
      ok: false,
      error: 'CODE_EXPIRED',
    });
  });

  it('thêm email cho tài khoản chưa có email; email đã thuộc người khác thì báo trùng', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const u = await db.user.create({ data: { displayName: 'Khách Zalo', passwordHash: 'x' } });
    const taken = await register({
      identifier: 'da-co@9mua.vn',
      displayName: 'Có',
      password: 'matkhau-9mua',
    });
    if (!taken.ok) throw new Error('setup');
    expect(
      await addEmailWithOtp(u.id, {
        email: 'da-co@9mua.vn',
        code: await sendCode('da-co@9mua.vn', 'add-email'),
      }),
    ).toEqual({ ok: false, error: 'EMAIL_TAKEN' });
    expect(
      await addEmailWithOtp(u.id, {
        email: 'zalo@9mua.vn',
        code: await sendCode('zalo@9mua.vn', 'add-email'),
      }),
    ).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe('zalo@9mua.vn');
  });

  it('Google trùng email tài khoản tạo bằng mã: nhập mã gửi về email đó để liên kết rồi đăng nhập', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const created = await loginWithEmailOtp({ email: 'gg@9mua.vn', code: await sendCode('gg@9mua.vn') });
    if (!created.ok) throw new Error('setup');
    const r = await completeGoogleLogin({ sub: 'g-123', email: 'gg@9mua.vn', name: 'GG' });
    if (r.kind !== 'link-required') throw new Error(r.kind);
    advanceClock({ seconds: 61 });
    const code = await sendCode('gg@9mua.vn', 'link');
    expect(await linkWithOtp(r.ticket, '000000' === code ? '111111' : '000000')).toEqual({
      ok: false,
      error: 'CODE_INVALID',
    });
    expect(await linkWithOtp(r.ticket, code)).toEqual({ ok: true, userId: created.userId });
    expect((await db.user.findUniqueOrThrow({ where: { id: created.userId } })).googleSub).toBe('g-123');
  });

  it('vé liên kết Facebook: liên kết vào bảng AuthIdentity; vé hết hạn thì không dùng được', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const u = await register({ identifier: 'fb@9mua.vn', displayName: 'FB', password: 'matkhau-9mua' });
    if (!u.ok) throw new Error('setup');
    const ticket = sealLinkTicket({ provider: 'facebook', subject: 'fb-9', email: 'fb@9mua.vn' });
    const code = await sendCode('fb@9mua.vn', 'link');
    expect(await linkWithOtp(ticket, code)).toEqual({ ok: true, userId: u.userId });
    expect(
      await db.authIdentity.findUnique({
        where: { provider_subject: { provider: 'facebook', subject: 'fb-9' } },
      }),
    ).toMatchObject({ userId: u.userId });

    const old = sealLinkTicket({ provider: 'facebook', subject: 'fb-10', email: 'fb@9mua.vn' });
    advanceClock({ minutes: 11 });
    expect(await linkWithOtp(old, await sendCode('fb@9mua.vn', 'link'))).toEqual({
      ok: false,
      error: 'TICKET_EXPIRED',
    });
  });

  it('đặt mật khẩu trong trang cá nhân bằng mã gửi về email của tài khoản (CEO chốt 29/10)', async () => {
    setClock(new Date('2026-10-29T03:00:00Z'));
    const created = await loginWithEmailOtp({
      email: 'datmk@9mua.vn',
      code: await sendCode('datmk@9mua.vn'),
    });
    if (!created.ok) throw new Error('setup');
    const keep = await createSession(created.userId);
    const other = await createSession(created.userId);
    advanceClock({ seconds: 61 });
    const code = await sendCode('datmk@9mua.vn', 'set-password');
    expect(await setPasswordWithOtp(created.userId, keep.sessionId, { code, newPassword: 'ngan' })).toEqual({
      ok: false,
      error: 'INVALID_PASSWORD',
    });
    expect(
      await setPasswordWithOtp(created.userId, keep.sessionId, {
        code: code === '000000' ? '111111' : '000000',
        newPassword: 'mat-khau-moi-9mua',
      }),
    ).toEqual({ ok: false, error: 'CODE_INVALID' });
    expect(
      await setPasswordWithOtp(created.userId, keep.sessionId, { code, newPassword: 'mat-khau-moi-9mua' }),
    ).toEqual({ ok: true });
    expect(await login({ identifier: 'datmk@9mua.vn', password: 'mat-khau-moi-9mua' })).toMatchObject({
      ok: true,
    });
    expect(await db.session.count({ where: { id: other.sessionId } })).toBe(0);
    expect(await db.session.count({ where: { id: keep.sessionId } })).toBe(1);

    // Chưa có email (tài khoản Zalo) và admin thì không dùng cách này.
    const zalo = await db.user.create({ data: { displayName: 'Zalo', passwordHash: 'x' } });
    expect(
      await setPasswordWithOtp(zalo.id, keep.sessionId, { code, newPassword: 'mat-khau-moi-9mua' }),
    ).toEqual({
      ok: false,
      error: 'NO_EMAIL',
    });
    await db.user.update({ where: { id: created.userId }, data: { role: 'admin' } });
    expect(
      await setPasswordWithOtp(created.userId, keep.sessionId, { code, newPassword: 'mat-khau-moi-9mua' }),
    ).toEqual({ ok: false, error: 'ADMIN' });
  });
});
