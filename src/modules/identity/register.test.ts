import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { register } from './register';

const base = { displayName: 'Nguyễn Hải', password: 'matkhau-9mua' };

describe('register', () => {
  it('đăng ký bằng SĐT, lưu dạng +84 và chỉ lưu mật khẩu đã băm', async () => {
    const result = await register({ ...base, identifier: '0979 393 916' });
    expect(result.ok).toBe(true);
    const user = await db.user.findFirstOrThrow();
    expect(user.phone).toBe('+84979393916');
    expect(user.email).toBeNull();
    expect(user.role).toBe('user');
    expect(user.passwordHash).not.toContain(base.password);
  });

  it('đăng ký bằng email', async () => {
    const result = await register({ ...base, identifier: 'A@9mua.com' });
    expect(result.ok).toBe(true);
    expect((await db.user.findFirstOrThrow()).email).toBe('a@9mua.com');
  });

  it('từ chối định danh đã tồn tại dù viết khác', async () => {
    await register({ ...base, identifier: '0979393916' });
    expect(await register({ ...base, identifier: '+84 979 393 916' })).toEqual({
      ok: false,
      error: 'IDENTIFIER_TAKEN',
    });
    await register({ ...base, identifier: 'a@9mua.com' });
    expect(await register({ ...base, identifier: 'A@9MUA.com' })).toEqual({
      ok: false,
      error: 'IDENTIFIER_TAKEN',
    });
  });

  it('hai lần đăng ký cùng lúc cùng SĐT chỉ một lần thành công', async () => {
    const results = await Promise.all([
      register({ ...base, identifier: '0979393916' }),
      register({ ...base, identifier: '0979393916' }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });

  it('báo lỗi theo từng trường khi dữ liệu không hợp lệ', async () => {
    const result = await register({ identifier: '123', displayName: 'A', password: 'short' });
    expect(result).toEqual({
      ok: false,
      error: 'INVALID_INPUT',
      fields: {
        identifier: expect.any(String),
        displayName: expect.any(String),
        password: expect.any(String),
      },
    });
    expect(await db.user.count()).toBe(0);
  });
});
