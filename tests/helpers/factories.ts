import { register } from '@/modules/identity/register';

let seq = 0;

// Tạo người dùng thử với SĐT duy nhất trong mỗi test.
export async function createUser(overrides: { displayName?: string; password?: string } = {}) {
  seq += 1;
  const phone = `09${String(10_000_000 + seq).slice(-8)}`;
  const result = await register({
    identifier: phone,
    displayName: overrides.displayName ?? `Người dùng ${seq}`,
    password: overrides.password ?? 'matkhau-9mua',
  });
  if (!result.ok) throw new Error(`createUser thất bại: ${JSON.stringify(result)}`);
  return { id: result.userId, phone, password: overrides.password ?? 'matkhau-9mua' };
}
