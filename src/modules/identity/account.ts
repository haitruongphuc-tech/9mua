import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { normalizeIdentifier } from './identifier';
import { hashPassword, verifyPassword } from './password';
import { registerInput } from './register';

export async function updateProfile(
  userId: string,
  input: { displayName: string },
): Promise<{ ok: true } | { ok: false; error: 'INVALID_INPUT'; message: string }> {
  const parsed = registerInput.shape.displayName.safeParse(input.displayName);
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
  await db.user.update({ where: { id: userId }, data: { displayName: parsed.data } });
  return { ok: true };
}

async function checkPassword(userId: string, password: string): Promise<boolean> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return verifyPassword(user.passwordHash, password);
}

// Chưa xác minh quyền sở hữu email (làm sau MVP); tạm thời bắt nhập lại mật khẩu.
export async function changeEmail(
  userId: string,
  input: { email: string; password: string },
): Promise<{ ok: true } | { ok: false; error: 'WRONG_PASSWORD' | 'INVALID_EMAIL' | 'EMAIL_TAKEN' }> {
  if (!(await checkPassword(userId, input.password))) return { ok: false, error: 'WRONG_PASSWORD' };
  const id = normalizeIdentifier(input.email);
  if (id?.kind !== 'email') return { ok: false, error: 'INVALID_EMAIL' };
  try {
    await db.user.update({ where: { id: userId }, data: { email: id.value } });
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'EMAIL_TAKEN' };
    }
    throw error;
  }
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: { oldPassword: string; newPassword: string },
): Promise<{ ok: true } | { ok: false; error: 'WRONG_PASSWORD' | 'INVALID_PASSWORD' }> {
  if (!registerInput.shape.password.safeParse(input.newPassword).success) {
    return { ok: false, error: 'INVALID_PASSWORD' };
  }
  if (!(await checkPassword(userId, input.oldPassword))) return { ok: false, error: 'WRONG_PASSWORD' };
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
    db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } }),
  ]);
  return { ok: true };
}
