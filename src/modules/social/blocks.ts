import { now } from '@/lib/clock';
import { db } from '@/lib/db';

export const MAX_BLOCKS = 1000;

// Chặn (SPEC-social.md V5.3): gỡ follow hai chiều. Chặn không đụng việc mua bán (đơn, khiếu nại vẫn xử lý bình thường).
export async function blockUser(
  blockerId: string,
  blockedId: string,
): Promise<{ ok: true } | { ok: false; error: 'SELF' | 'LIMIT' }> {
  if (blockerId === blockedId) return { ok: false, error: 'SELF' };
  const exists = await db.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } } });
  if (!exists) {
    if ((await db.userBlock.count({ where: { blockerId } })) >= MAX_BLOCKS)
      return { ok: false, error: 'LIMIT' };
    await db.userBlock.createMany({
      data: [{ blockerId, blockedId, createdAt: now() }],
      skipDuplicates: true,
    });
  }
  await db.follow.deleteMany({
    where: {
      OR: [
        { followerId: blockerId, followeeId: blockedId },
        { followerId: blockedId, followeeId: blockerId },
      ],
    },
  });
  return { ok: true };
}

// Bỏ chặn ở Cài đặt gỡ luôn chặn của Hộp thư (danh sách đã gộp).
export async function unblockUser(blockerId: string, blockedId: string): Promise<{ ok: boolean }> {
  const [a, b] = await db.$transaction([
    db.userBlock.deleteMany({ where: { blockerId, blockedId } }),
    db.messageBlock.deleteMany({ where: { blockerId, blockedId } }),
  ]);
  return { ok: a.count + b.count > 0 };
}

export async function listBlockedUsers(
  blockerId: string,
): Promise<{ id: string; displayName: string; avatarUrl: string | null }[]> {
  const rows = await db.userBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: 'desc' },
    take: MAX_BLOCKS,
  });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.blockedId) } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.flatMap((r) => byId.get(r.blockedId) ?? []);
}
