import { Prisma } from '@prisma/client';
import { db } from './db';

// Chặn trên toàn web (SPEC-social.md V5.3): một chiều là đủ để cả hai không thấy nhau. Dùng chung cho mọi module (feed,
// bình luận, live, Hộp thư…) nên nằm ở lib; ghi/xoá chặn nằm ở module social.
export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const n = await db.userBlock.count({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
  });
  return n > 0;
}

// Điều kiện SQL "cột người dùng này không chặn nhau với người xem". Không có người xem thì luôn đúng.
export function notBlockedWith(viewerId: string | undefined | null, userColumn: Prisma.Sql): Prisma.Sql {
  if (!viewerId) return Prisma.sql`TRUE`;
  return Prisma.sql`NOT EXISTS (SELECT 1 FROM "UserBlock" ub
    WHERE (ub."blockerId" = ${viewerId} AND ub."blockedId" = ${userColumn})
       OR (ub."blockerId" = ${userColumn} AND ub."blockedId" = ${viewerId}))`;
}

// Mọi người chặn nhau với userId (cả hai chiều), để lọc danh sách nhỏ (bình luận, chat).
export async function blockedEitherIds(userId: string | undefined | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await db.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}
