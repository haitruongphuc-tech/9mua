import { now } from '@/lib/clock';
import { isBlockedEither } from '@/lib/blocks';
import { db } from '@/lib/db';
import { getKiotByOwner, isKiotActive } from '@/modules/kiot';

// Cặp người dùng theo thứ tự chữ: mỗi cặp chỉ có 1 cuộc trò chuyện.
export const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export const otherOf = (c: { userAId: string; userBId: string }, userId: string) =>
  c.userAId === userId ? c.userBId : c.userAId;

export const isMember = (c: { userAId: string; userBId: string }, userId: string) =>
  c.userAId === userId || c.userBId === userId;

export async function activeBan(userId: string): Promise<boolean> {
  const at = now();
  return (await db.messageBan.count({ where: { userId, OR: [{ until: null }, { until: { gt: at } }] } })) > 0;
}

// Chặn theo cả hai chiều: người bị chặn không gửi được, người chặn cũng không gửi cho người mình đã chặn. Chặn trên toàn
// web (SPEC-social.md V5.3) cũng chặn nhắn tin.
export async function isBlocked(a: string, b: string): Promise<boolean> {
  if (await isBlockedEither(a, b)) return true;
  return (
    (await db.messageBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    })) > 0
  );
}

export async function isActiveShopOwner(userId: string): Promise<boolean> {
  const kiot = await getKiotByOwner(userId);
  return Boolean(kiot && isKiotActive(kiot));
}
