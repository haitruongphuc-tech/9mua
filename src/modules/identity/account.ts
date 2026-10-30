import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { normalizeIdentifier } from './identifier';
import { hashPassword, verifyPassword } from './password';
import { MAX_BIO, MAX_BIO_LINES } from './profile';
import { registerInput } from './register';

// Đổi tên hiển thị và/hoặc giới thiệu (SPEC-social.md bổ sung 30/10, A2). Trường nào không gửi thì giữ nguyên.
export async function updateProfile(
  userId: string,
  input: { displayName?: string; bio?: string },
): Promise<
  | { ok: true }
  | { ok: false; error: 'INVALID_INPUT'; message: string }
  | { ok: false; error: 'BIO_TOO_LONG' | 'HAS_LINK' }
> {
  const data: { displayName?: string; bio?: string | null } = {};
  if (input.displayName !== undefined) {
    const parsed = registerInput.shape.displayName.safeParse(input.displayName);
    if (!parsed.success)
      return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
    data.displayName = parsed.data;
  }
  if (input.bio !== undefined) {
    const bio = input.bio.replace(/\r\n?/g, '\n').trim();
    if ([...bio].length > MAX_BIO || bio.split('\n').length > MAX_BIO_LINES)
      return { ok: false, error: 'BIO_TOO_LONG' };
    if (hasLink(bio)) return { ok: false, error: 'HAS_LINK' };
    data.bio = bio || null;
  }
  await db.user.update({ where: { id: userId }, data });
  return { ok: true };
}

// Xác nhận lại mật khẩu cho thao tác nhạy cảm (đổi email, đổi tài khoản nhận tiền).
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return verifyPassword(user.passwordHash, password);
}

// Chưa xác minh quyền sở hữu email (làm sau MVP); tạm thời bắt nhập lại mật khẩu.
export async function changeEmail(
  userId: string,
  input: { email: string; password: string },
): Promise<{ ok: true } | { ok: false; error: 'WRONG_PASSWORD' | 'INVALID_EMAIL' | 'EMAIL_TAKEN' }> {
  if (!(await verifyUserPassword(userId, input.password))) return { ok: false, error: 'WRONG_PASSWORD' };
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
  if (!(await verifyUserPassword(userId, input.oldPassword))) return { ok: false, error: 'WRONG_PASSWORD' };
  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
    db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } }),
  ]);
  return { ok: true };
}

// Dấu vân tay của mật khẩu hiện tại (không lộ mã băm): đổi mật khẩu thì đổi theo. Admin dùng để thiết bị đã nhớ tự
// hết hiệu lực khi đổi mật khẩu (SPEC-admin.md bổ sung 27/10).
export async function passwordFingerprint(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  return createHash('sha256').update(`9mua-pw:${user.passwordHash}`).digest('hex').slice(0, 32);
}
