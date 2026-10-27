import { generateKeyPairSync, sign } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { completeGoogleLogin, linkGoogleWithTicket, pkceChallenge, verifyGoogleIdToken } from './google';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const jwks = async () => [jwk];
const NOW = Date.UTC(2026, 9, 27, 3, 0, 0);

function token(payload: Record<string, unknown>, kid = 'k1', key = privateKey) {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = enc({ alg: 'RS256', kid, typ: 'JWT' });
  const body = enc(payload);
  return `${head}.${body}.${sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url')}`;
}

const good = {
  iss: 'https://accounts.google.com',
  aud: 'client-1',
  sub: 'g-123',
  email: 'Khach@Gmail.com',
  email_verified: true,
  name: 'Khách Google',
  nonce: 'n-1',
  exp: NOW / 1000 + 600,
};
const verifyOpts = { clientId: 'client-1', nonce: 'n-1', jwks, nowMs: NOW };

describe('verifyGoogleIdToken', () => {
  it('token hợp lệ → thông tin người dùng, email chữ thường', async () => {
    expect(await verifyGoogleIdToken(token(good), verifyOpts)).toEqual({
      sub: 'g-123',
      email: 'khach@gmail.com',
      name: 'Khách Google',
    });
  });

  it.each([
    ['sai aud', { aud: 'client-khac' }],
    ['sai iss', { iss: 'https://evil.example' }],
    ['hết hạn', { exp: NOW / 1000 - 3600 }],
    ['sai nonce', { nonce: 'n-2' }],
    ['email chưa xác minh', { email_verified: false }],
  ])('%s → từ chối', async (_name, patch) => {
    expect(await verifyGoogleIdToken(token({ ...good, ...patch }), verifyOpts)).toBeNull();
  });

  it('chữ ký bằng khoá khác → từ chối', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    expect(await verifyGoogleIdToken(token(good, 'k1', other), verifyOpts)).toBeNull();
  });

  it('kid lạ hoặc token hỏng → từ chối', async () => {
    expect(await verifyGoogleIdToken(token(good, 'k9'), verifyOpts)).toBeNull();
    expect(await verifyGoogleIdToken('abc.def', verifyOpts)).toBeNull();
  });
});

describe('pkceChallenge', () => {
  it('đúng ví dụ trong RFC 7636', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

describe('completeGoogleLogin', () => {
  const stamp = String(Date.now()).slice(-7);
  const email = () => `gg${stamp}${Math.random().toString(36).slice(2, 6)}@gmail.com`;

  beforeEach(() => undefined);

  it('email mới → tạo tài khoản đã liên kết; lần sau đăng nhập luôn', async () => {
    const claims = { sub: `sub-${email()}`, email: email(), name: 'Người Mới' };
    const first = await completeGoogleLogin(claims);
    expect(first.kind).toBe('login');
    const user = await db.user.findUniqueOrThrow({ where: { email: claims.email } });
    expect(user.googleSub).toBe(claims.sub);
    expect(await completeGoogleLogin(claims)).toEqual({ kind: 'login', userId: user.id });
  });

  it('email trùng tài khoản cũ → không tự liên kết; liên kết sau khi đăng nhập mật khẩu', async () => {
    const e = email();
    const old = await db.user.create({ data: { email: e, displayName: 'Cũ', passwordHash: 'x' } });
    const result = await completeGoogleLogin({ sub: `sub-${e}`, email: e, name: 'Cũ' });
    expect(result.kind).toBe('link-required');
    expect((await db.user.findUniqueOrThrow({ where: { id: old.id } })).googleSub).toBeNull();

    // Vé chỉ liên kết đúng tài khoản có email đó.
    const stranger = await db.user.create({ data: { email: email(), displayName: 'Lạ', passwordHash: 'x' } });
    const ticket = result.kind === 'link-required' ? result.ticket : '';
    expect(await linkGoogleWithTicket(stranger.id, ticket)).toBe(false);
    expect(await linkGoogleWithTicket(old.id, ticket)).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: old.id } })).googleSub).toBe(`sub-${e}`);
  });

  it('admin không đăng nhập bằng Google; tài khoản bị khoá cũng không', async () => {
    const a = email();
    await db.user.create({ data: { email: a, displayName: 'Admin', passwordHash: 'x', role: 'admin' } });
    expect(await completeGoogleLogin({ sub: `sub-${a}`, email: a, name: 'A' })).toEqual({
      kind: 'error',
      error: 'ADMIN',
    });
    const l = email();
    await db.user.create({
      data: { email: l, displayName: 'Khoá', passwordHash: 'x', googleSub: `sub-${l}`, lockedAt: new Date() },
    });
    expect(await completeGoogleLogin({ sub: `sub-${l}`, email: l, name: 'L' })).toEqual({
      kind: 'error',
      error: 'LOCKED',
    });
  });
});
