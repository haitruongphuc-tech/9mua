import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { appleClientSecret, appleIdentity, completeOauthLogin } from './oauth';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const idToken = (claims: object) => `${b64({ alg: 'RS256' })}.${b64(claims)}.chu-ky`;

describe('đăng nhập Apple (SPEC-identity.md V5.4)', () => {
  it('client_secret là JWT ES256 ký bằng khoá .p8, kiểm được bằng khoá công khai', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n');
    const jwt = appleClientSecret({
      clientId: 'com.9mua.web',
      teamId: 'TEAM123',
      keyId: 'KEY123',
      privateKey: pem,
    });
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY123' });
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toMatchObject({
      iss: 'TEAM123',
      sub: 'com.9mua.web',
      aud: 'https://appleid.apple.com',
    });
    const ok = createVerify('SHA256')
      .update(`${h}.${p}`)
      .verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url'));
    expect(ok).toBe(true);
  });

  it('id_token: đúng iss/aud/hạn mới nhận; email chỉ lấy khi đã xác minh', () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const base = { iss: 'https://appleid.apple.com', aud: 'com.9mua.web', sub: '001.abc', exp };
    expect(
      appleIdentity(idToken({ ...base, email: 'A@B.vn', email_verified: 'true' }), 'com.9mua.web'),
    ).toEqual({
      sub: '001.abc',
      email: 'a@b.vn',
    });
    expect(
      appleIdentity(idToken({ ...base, email: 'a@b.vn', email_verified: false }), 'com.9mua.web'),
    ).toEqual({
      sub: '001.abc',
      email: null,
    });
    expect(appleIdentity(idToken({ ...base, aud: 'khac' }), 'com.9mua.web')).toBeNull();
    expect(appleIdentity(idToken({ ...base, iss: 'https://gia.mao' }), 'com.9mua.web')).toBeNull();
    expect(appleIdentity(idToken({ ...base, exp: 1 }), 'com.9mua.web')).toBeNull();
    expect(appleIdentity('khong-phai-jwt', 'com.9mua.web')).toBeNull();
  });

  it('lần đầu tạo tài khoản; email trùng tài khoản có sẵn thì bắt liên kết', async () => {
    const sub = `apple-${Date.now()}`;
    const first = await completeOauthLogin('apple', {
      subject: sub,
      name: 'Nguyễn An',
      email: `${sub}@icloud.com`,
    });
    expect(first).toMatchObject({ kind: 'login', created: true });
    const again = await completeOauthLogin('apple', { subject: sub, name: '', email: null });
    expect(again).toMatchObject({ kind: 'login', created: false });
    const existing = await db.user.create({
      data: { email: `${sub}-cu@icloud.com`, displayName: 'Cũ', passwordHash: 'x' },
    });
    const link = await completeOauthLogin('apple', {
      subject: `${sub}-2`,
      name: 'Ai đó',
      email: existing.email,
    });
    expect(link).toMatchObject({ kind: 'link-required', email: existing.email });
  });
});
