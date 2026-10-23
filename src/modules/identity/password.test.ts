import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('băm bằng argon2id và không chứa mật khẩu gốc', async () => {
    const hash = await hashPassword('matkhau-9mua');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('matkhau-9mua');
  });

  it('xác minh đúng/sai', async () => {
    const hash = await hashPassword('matkhau-9mua');
    expect(await verifyPassword(hash, 'matkhau-9mua')).toBe(true);
    expect(await verifyPassword(hash, 'matkhau-9muA')).toBe(false);
  });

  it('chuỗi băm hỏng trả false thay vì ném lỗi', async () => {
    expect(await verifyPassword('khong-phai-hash', 'x')).toBe(false);
  });
});
