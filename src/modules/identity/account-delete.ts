import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword } from './password';
import { consumeOtpForUser } from './otp';

// Tự xoá tài khoản (SPEC-identity.md V5.3). Yêu cầu xoá: khoá tài khoản (ẩn trang cá nhân, đăng xuất mọi thiết bị) với
// lockedAt = deleteRequestedAt. Đăng nhập lại trong 30 ngày là huỷ xoá. Hết 30 ngày: ẩn danh hoá (việc hằng ngày).
// Điều kiện về tiền / đơn hàng nằm ở tầng ứng dụng (src/server/account-delete.ts) vì cần đọc module khác.
import { DELETE_WAIT_DAYS } from './deletion-lock';

export { DELETE_WAIT_DAYS };
export const DELETED_NAME = 'Tài khoản đã xoá';
const DAY = 86_400_000;

export type DeleteConfirm = { password: string } | { code: string };
export type DeleteRequestError =
  'ADMIN' | 'BAD_PASSWORD' | 'CODE_INVALID' | 'CODE_EXPIRED' | 'NO_EMAIL' | 'NOT_FOUND';

// Xác nhận bằng mật khẩu, hoặc mã email (tài khoản đăng nhập bằng mã / Google / Zalo / Facebook không nhớ mật khẩu).
export async function confirmAccountDeletion(
  userId: string,
  confirm: DeleteConfirm,
): Promise<{ ok: true } | { ok: false; error: DeleteRequestError }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return { ok: false, error: 'NOT_FOUND' };
  if (user.role === 'admin') return { ok: false, error: 'ADMIN' };
  if ('password' in confirm) {
    if (!(await verifyPassword(user.passwordHash, confirm.password)))
      return { ok: false, error: 'BAD_PASSWORD' };
  } else {
    if (!user.email) return { ok: false, error: 'NO_EMAIL' };
    const check = await consumeOtpForUser(user.email, 'delete-account', confirm.code);
    if (check !== 'ok') return { ok: false, error: check };
  }
  return { ok: true };
}

// Ghi yêu cầu xoá: khoá + đăng xuất mọi thiết bị. Gọi sau confirmAccountDeletion và kiểm điều kiện tiền / đơn.
export async function markAccountDeletion(userId: string): Promise<void> {
  const t = now();
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { deleteRequestedAt: t, lockedAt: t } }),
    db.session.deleteMany({ where: { userId } }),
  ]);
}

// Tài khoản đã quá 30 ngày chờ, chưa ẩn danh hoá.
export async function accountsDueForDeletion(limit = 50): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      deletedAt: null,
      deleteRequestedAt: { lte: new Date(now().getTime() - DELETE_WAIT_DAYS * DAY) },
    },
    select: { id: true, deleteRequestedAt: true, lockedAt: true },
    take: limit,
  });
  return rows
    .filter((r) => r.lockedAt && r.deleteRequestedAt?.getTime() === r.lockedAt.getTime())
    .map((r) => r.id);
}

// Ẩn danh hoá phần identity: tên "Tài khoản đã xoá"; xoá email, SĐT, ảnh, giới thiệu, @tên, liên kết đăng nhập,
// mật khẩu (thay bằng chuỗi ngẫu nhiên). Giữ dòng User để sổ tiền, đơn hàng, nhật ký CEO vẫn trỏ được.
export async function anonymizeUser(
  userId: string,
): Promise<{ avatarUrl: string | null; coverUrl: string | null }> {
  const before = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarUrl: true, coverUrl: true },
  });
  const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: {
        displayName: DELETED_NAME,
        email: null,
        phone: null,
        googleSub: null,
        avatarUrl: null,
        coverUrl: null,
        bio: null,
        handle: null,
        previousHandle: null,
        previousHandleUntil: null,
        passwordHash,
        isPrivate: false,
        deletedAt: now(),
      },
    }),
    db.authIdentity.deleteMany({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }),
    db.passwordResetToken.deleteMany({ where: { userId } }),
  ]);
  return before;
}

export async function deletionStatus(
  userId: string,
): Promise<{ requestedAt: Date | null; deletedAt: Date | null }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { deleteRequestedAt: true, deletedAt: true },
  });
  return { requestedAt: u?.deleteRequestedAt ?? null, deletedAt: u?.deletedAt ?? null };
}
