import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { resetEnvCache } from '@/lib/env';
import { linkWithTicket } from './link';
import { completeOauthLogin, openOauthFlow, profileFromCode, startOauthFlow } from './oauth';
import { register } from './register';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

function realKeys() {
  vi.stubEnv('ZALO_APP_ID', 'zalo-app');
  vi.stubEnv('ZALO_APP_SECRET', 'zalo-secret');
  vi.stubEnv('FACEBOOK_APP_ID', 'fb-app');
  vi.stubEnv('FACEBOOK_APP_SECRET', 'fb-secret');
  resetEnvCache();
}

describe('luồng Zalo / Facebook (SPEC-identity.md bổ sung 29/10)', () => {
  it('Zalo: địa chỉ có PKCE; đổi mã gửi secret_key ở header kèm code_verifier; lấy id, tên', async () => {
    realKeys();
    const { url, cookie } = startOauthFlow('zalo', '/kiot-cua-toi');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://oauth.zaloapp.com/v4/permission');
    expect(u.searchParams.get('app_id')).toBe('zalo-app');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('redirect_uri')).toMatch(/\/api\/auth\/zalo\/callback$/);
    const flow = openOauthFlow('zalo', cookie, u.searchParams.get('state'));
    expect(flow?.next).toBe('/kiot-cua-toi');
    expect(openOauthFlow('facebook', cookie, u.searchParams.get('state'))).toBeNull();
    expect(openOauthFlow('zalo', cookie, 'sai')).toBeNull();

    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      calls.push({ url: String(input), init });
      return String(input).startsWith('https://oauth.zaloapp.com/v4/access_token')
        ? json({ access_token: 'zt', expires_in: '3600' })
        : json({ id: '123456', name: 'Chị Zalo', error: 0, message: 'Success' });
    });
    expect(await profileFromCode('zalo', 'ma-zalo', flow!, fetchImpl)).toEqual({
      subject: '123456',
      name: 'Chị Zalo',
      email: null,
    });
    const token = calls[0]!;
    expect(token.init?.method).toBe('POST');
    expect((token.init?.headers as Record<string, string>).secret_key).toBe('zalo-secret');
    const body = new URLSearchParams(String(token.init?.body));
    expect(body.get('code')).toBe('ma-zalo');
    expect(body.get('app_id')).toBe('zalo-app');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe(flow!.verifier);
    expect(calls[1]!.url).toMatch(/^https:\/\/graph\.zalo\.me\/v2\.0\/me\?fields=id%2Cname/);
    expect((calls[1]!.init?.headers as Record<string, string>).access_token).toBe('zt');
  });

  it('Zalo báo lỗi thì không đăng nhập', async () => {
    realKeys();
    const { url, cookie } = startOauthFlow('zalo', '/');
    const flow = openOauthFlow('zalo', cookie, new URL(url).searchParams.get('state'))!;
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ error: -14003, error_description: 'invalid code' }),
    );
    expect(await profileFromCode('zalo', 'x', flow, fetchImpl)).toBeNull();
  });

  it('Facebook: đổi mã ở máy chủ, gọi /me kèm appsecret_proof, lấy email nếu có', async () => {
    realKeys();
    const { url, cookie } = startOauthFlow('facebook', '/');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/v25.0/dialog/oauth');
    expect(u.searchParams.get('scope')).toBe('public_profile,email');
    const flow = openOauthFlow('facebook', cookie, u.searchParams.get('state'))!;
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      calls.push(String(input));
      return String(input).includes('/oauth/access_token')
        ? json({ access_token: 'ft', token_type: 'bearer' })
        : json({ id: '777', name: 'Anh FB', email: 'Anh.FB@Gmail.com' });
    });
    expect(await profileFromCode('facebook', 'ma-fb', flow, fetchImpl)).toEqual({
      subject: '777',
      name: 'Anh FB',
      email: 'anh.fb@gmail.com',
    });
    const tokenUrl = new URL(calls[0]!);
    expect(tokenUrl.origin + tokenUrl.pathname).toBe('https://graph.facebook.com/v25.0/oauth/access_token');
    expect(tokenUrl.searchParams.get('client_secret')).toBe('fb-secret');
    expect(tokenUrl.searchParams.get('code')).toBe('ma-fb');
    const me = new URL(calls[1]!);
    expect(me.pathname).toBe('/v25.0/me');
    expect(me.searchParams.get('appsecret_proof')).toBe(
      createHmac('sha256', 'fb-secret').update('ft').digest('hex'),
    );
  });

  it('tài khoản Zalo mới: tạo tài khoản chỉ có tên; lần sau đăng nhập đúng tài khoản đó', async () => {
    const first = await completeOauthLogin('zalo', { subject: 'z-1', name: 'Chị Zalo', email: null });
    expect(first).toMatchObject({ kind: 'login', created: true });
    if (first.kind !== 'login') return;
    const user = await db.user.findUniqueOrThrow({ where: { id: first.userId } });
    expect(user).toMatchObject({ displayName: 'Chị Zalo', email: null, phone: null });
    expect(await completeOauthLogin('zalo', { subject: 'z-1', name: 'Tên khác', email: null })).toEqual({
      kind: 'login',
      userId: first.userId,
      created: false,
    });
  });

  it('Facebook có email mới thì tạo tài khoản có email; email trùng thì bắt xác nhận rồi mới liên kết', async () => {
    const fresh = await completeOauthLogin('facebook', {
      subject: 'f-1',
      name: 'FB',
      email: 'moi.fb@9mua.vn',
    });
    expect(fresh).toMatchObject({ kind: 'login', created: true });
    if (fresh.kind === 'login')
      expect((await db.user.findUniqueOrThrow({ where: { id: fresh.userId } })).email).toBe('moi.fb@9mua.vn');

    const old = await register({ identifier: 'cu.fb@9mua.vn', displayName: 'Cũ', password: 'matkhau-9mua' });
    if (!old.ok) throw new Error('setup');
    const r = await completeOauthLogin('facebook', { subject: 'f-2', name: 'FB', email: 'cu.fb@9mua.vn' });
    if (r.kind !== 'link-required') throw new Error(r.kind);
    expect(await db.authIdentity.count({ where: { subject: 'f-2' } })).toBe(0);
    expect(await linkWithTicket(old.userId, r.ticket)).toBe(true);
    expect(
      await completeOauthLogin('facebook', { subject: 'f-2', name: 'FB', email: 'cu.fb@9mua.vn' }),
    ).toEqual({
      kind: 'login',
      userId: old.userId,
      created: false,
    });
  });

  it('admin và tài khoản bị khoá không đăng nhập bằng Zalo/Facebook', async () => {
    const admin = await register({
      identifier: 'ad.fb@9mua.vn',
      displayName: 'CEO',
      password: 'matkhau-9mua',
    });
    if (!admin.ok) throw new Error('setup');
    await db.user.update({ where: { id: admin.userId }, data: { role: 'admin' } });
    expect(
      await completeOauthLogin('facebook', { subject: 'f-ad', name: 'CEO', email: 'ad.fb@9mua.vn' }),
    ).toEqual({
      kind: 'error',
      error: 'ADMIN',
    });
    const z = await completeOauthLogin('zalo', { subject: 'z-khoa', name: 'Khoá', email: null });
    if (z.kind !== 'login') throw new Error(z.kind);
    await db.user.update({ where: { id: z.userId }, data: { lockedAt: new Date() } });
    expect(await completeOauthLogin('zalo', { subject: 'z-khoa', name: 'Khoá', email: null })).toEqual({
      kind: 'error',
      error: 'LOCKED',
    });
  });
});
