import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { blockUser as blockEverywhere, unblockUser as unblockEverywhere } from '@/modules/social';
import { pair } from './access';

// Chặn (SPEC-messages.md mục 7): người bị chặn không gửi được; cuộc trò chuyện ẩn khỏi hộp thư người chặn.
export async function blockUser(userId: string, otherUserId: string): Promise<{ ok: boolean }> {
  if (userId === otherUserId) return { ok: false };
  const at = now();
  await db.messageBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: otherUserId } },
    create: { blockerId: userId, blockedId: otherUserId, createdAt: at },
    update: {},
  });
  // Chặn ở Hộp thư cũng là chặn trên toàn web (SPEC-social.md V5.3).
  await blockEverywhere(userId, otherUserId);
  const [userAId, userBId] = pair(userId, otherUserId);
  const c = await db.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (c)
    await db.conversationMember.updateMany({
      where: { conversationId: c.id, userId },
      data: { hiddenAt: at },
    });
  return { ok: true };
}

export async function unblockUser(userId: string, otherUserId: string): Promise<{ ok: boolean }> {
  const { count } = await db.messageBlock.deleteMany({
    where: { blockerId: userId, blockedId: otherUserId },
  });
  const all = await unblockEverywhere(userId, otherUserId);
  return { ok: count > 0 || all.ok };
}

export async function listBlocked(userId: string): Promise<{ id: string; displayName: string }[]> {
  const rows = await db.messageBlock.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
  });
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.blockedId) } },
    select: { id: true, displayName: true },
  });
  return rows.map((r) => users.find((u) => u.id === r.blockedId) ?? { id: r.blockedId, displayName: '' });
}
