import { now } from '@/lib/clock';
import { db } from '@/lib/db';

// Tự xoá tài khoản (SPEC-identity.md V5.3): 30 ngày chờ, đăng nhập lại là huỷ xoá.
export const DELETE_WAIT_DAYS = 30;
const DAY = 86_400_000;

// Đăng nhập lại trong 30 ngày → huỷ xoá. Chỉ mở khoá khi khoá là do chính yêu cầu xoá (CEO khoá thì vẫn khoá).
// Trả true nếu tài khoản còn bị khoá (đăng nhập phải từ chối).
export async function lockedForLogin(user: {
  id: string;
  lockedAt: Date | null;
  deleteRequestedAt?: Date | null;
  deletedAt?: Date | null;
}): Promise<boolean> {
  if (!user.lockedAt) return false;
  const full =
    user.deleteRequestedAt === undefined
      ? await db.user.findUnique({
          where: { id: user.id },
          select: { deleteRequestedAt: true, deletedAt: true },
        })
      : { deleteRequestedAt: user.deleteRequestedAt, deletedAt: user.deletedAt ?? null };
  const req = full?.deleteRequestedAt;
  if (!req || full?.deletedAt) return true;
  if (req.getTime() !== user.lockedAt.getTime()) return true;
  if (now().getTime() - req.getTime() >= DELETE_WAIT_DAYS * DAY) return true;
  const r = await db.user.updateMany({
    where: { id: user.id, deleteRequestedAt: req, deletedAt: null },
    data: { deleteRequestedAt: null, lockedAt: null },
  });
  return r.count === 0;
}
