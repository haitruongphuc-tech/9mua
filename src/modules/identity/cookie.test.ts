import { describe, expect, it } from 'vitest';
import { sessionCookieOptions } from './cookie';

describe('sessionCookieOptions', () => {
  it('production: dùng chung cho mọi *.9mua.com, Secure, httpOnly, Lax', () => {
    expect(sessionCookieOptions('https://9mua.com')).toMatchObject({
      domain: '.9mua.com',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('dev localhost: không Secure', () => {
    expect(sessionCookieOptions('http://localhost:3000')).toMatchObject({
      domain: 'localhost',
      secure: false,
    });
  });
});
