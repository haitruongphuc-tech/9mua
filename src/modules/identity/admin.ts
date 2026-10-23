import { randomInt } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { normalizeIdentifier } from './identifier';
import { hashPassword } from './password';
import { registerInput } from './register';

export async function lockUser(userId: string): Promise<void> {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { lockedAt: now() } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}

export async function unlockUser(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { lockedAt: null } });
}

// Bỏ ký tự dễ nhầm (0/O, 1/l/I) vì CEO đọc mật khẩu tạm qua điện thoại cho người dùng.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function resetPassword(userId: string): Promise<{ tempPassword: string }> {
  const tempPassword = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  const passwordHash = await hashPassword(tempPassword);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
  return { tempPassword };
}

export type CreateAdminResult =
  | { ok: true; created: boolean; userId: string }
  | { ok: false; error: 'INVALID_IDENTIFIER' | 'INVALID_INPUT'; message: string };

// Dùng cho lệnh CLI trên VPS. Tài khoản đã tồn tại thì chỉ nâng quyền, giữ nguyên mật khẩu.
export async function createAdmin(input: {
  identifier: string;
  displayName: string;
  password: string;
}): Promise<CreateAdminResult> {
  const id = normalizeIdentifier(input.identifier);
  if (!id) return { ok: false, error: 'INVALID_IDENTIFIER', message: 'SĐT hoặc email không hợp lệ' };

  const existing = await db.user.findUnique({ where: id.where });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
    return { ok: true, created: false, userId: existing.id };
  }

  const parsed = registerInput.pick({ displayName: true, password: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
  const user = await db.user.create({
    data: {
      ...id.where,
      displayName: parsed.data.displayName,
      passwordHash: await hashPassword(parsed.data.password),
      role: 'admin',
    },
  });
  return { ok: true, created: true, userId: user.id };
}
