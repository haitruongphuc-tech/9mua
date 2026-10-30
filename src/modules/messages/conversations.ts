import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { followRelation, isFreeAccount, vnDay } from '@/modules/social';
import { activeBan, isActiveShopOwner, isBlocked, isMember, otherOf, pair } from './access';
import { FREE_NEW_PER_DAY, NEW_ACCOUNT_MS } from './rules';
import { peers, toViews, type ConversationPeer, type MessageView } from './view';

export type OpenError = 'SELF' | 'NOT_FOUND' | 'BLOCKED' | 'BANNED' | 'FREE_LIMIT' | 'NEW_ACCOUNT';

// Tài khoản Free: tăng đếm có điều kiện (chỉ khi còn dưới giới hạn) để hai yêu cầu cùng lúc không vượt.
async function consumeNewConversation(userId: string): Promise<boolean> {
  if (!(await isFreeAccount(userId))) return true;
  const day = vnDay(now());
  await db.$executeRaw`INSERT INTO "NewConversationDaily" ("userId", "day", "count") VALUES (${userId}, ${day}, 0)
    ON CONFLICT DO NOTHING`;
  const n = await db.$executeRaw`UPDATE "NewConversationDaily" SET "count" = "count" + 1
    WHERE "userId" = ${userId} AND "day" = ${day} AND "count" < ${FREE_NEW_PER_DAY}`;
  return n === 1;
}

// Mở (hoặc mở lại) cuộc trò chuyện 1-1 (SPEC-messages.md mục 2–3, 5). Nhắn chủ Kiot đang hoạt động hoặc người có quan
// hệ follow thì vào thẳng hộp thư chính; còn lại là "tin nhắn chờ" của người nhận.
export async function openConversation(
  userId: string,
  otherUserId: string,
): Promise<{ ok: true; conversationId: string } | { ok: false; error: OpenError }> {
  if (userId === otherUserId) return { ok: false, error: 'SELF' };
  const [me, other] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    db.user.findUnique({ where: { id: otherUserId }, select: { id: true, lockedAt: true } }),
  ]);
  if (!me || !other || other.lockedAt) return { ok: false, error: 'NOT_FOUND' };
  if (await activeBan(userId)) return { ok: false, error: 'BANNED' };
  if (await isBlocked(userId, otherUserId)) return { ok: false, error: 'BLOCKED' };

  const [userAId, userBId] = pair(userId, otherUserId);
  const existing = await db.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  if (existing) {
    await db.conversationMember.updateMany({
      where: { conversationId: existing.id, userId },
      data: { hiddenAt: null },
    });
    return { ok: true, conversationId: existing.id };
  }

  const at = now();
  const toShop = await isActiveShopOwner(otherUserId);
  if (!toShop && at.getTime() - me.createdAt.getTime() < NEW_ACCOUNT_MS)
    return { ok: false, error: 'NEW_ACCOUNT' };
  if (!(await consumeNewConversation(userId))) return { ok: false, error: 'FREE_LIMIT' };
  const active = toShop || (await followRelation(userId, otherUserId));
  try {
    const c = await db.conversation.create({
      data: {
        userAId,
        userBId,
        status: active ? 'active' : 'request',
        requestedById: active ? null : userId,
        acceptedAt: active ? at : null,
        lastMessageAt: at,
        createdAt: at,
      },
    });
    await db.conversationMember.createMany({
      data: [
        { conversationId: c.id, userId: userAId },
        { conversationId: c.id, userId: userBId },
      ],
    });
    return { ok: true, conversationId: c.id };
  } catch (e) {
    // Hai người bấm "Nhắn tin" cho nhau cùng lúc: dùng cuộc trò chuyện vừa được tạo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const c = await db.conversation.findUniqueOrThrow({ where: { userAId_userBId: { userAId, userBId } } });
      return { ok: true, conversationId: c.id };
    }
    throw e;
  }
}

export type ConversationView = {
  id: string;
  other: ConversationPeer;
  status: 'request' | 'active';
  requestedByMe: boolean;
  last: { text: string | null; kind: 'text' | 'image' | 'product' | 'hidden'; fromMe: boolean };
  lastMessageAt: string;
  unread: number;
};

type LastRow = {
  conversationId: string;
  senderId: string;
  text: string | null;
  imageId: string | null;
  hiddenAt: Date | null;
};

// Hộp thư chính: cuộc trò chuyện đã chấp nhận và cuộc do mình mở; "Tin nhắn chờ": người lạ nhắn mình. Không hiện cuộc
// chưa có tin nào, cuộc mình đã xoá phía mình, và người mình đã chặn. Tối đa 50 cuộc mới nhất.
export async function listConversations(
  userId: string,
  folder: 'inbox' | 'requests',
): Promise<ConversationView[]> {
  const members = await db.conversationMember.findMany({ where: { userId, hiddenAt: null } });
  if (members.length === 0) return [];
  const readAt = new Map(members.map((m) => [m.conversationId, m.lastReadAt]));
  const blocked = new Set(
    (await db.messageBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } })).map(
      (b) => b.blockedId,
    ),
  );
  const convs = (
    await db.conversation.findMany({
      where: { id: { in: members.map((m) => m.conversationId) } },
      orderBy: { lastMessageAt: 'desc' },
    })
  ).filter((c) => {
    if (blocked.has(otherOf(c, userId))) return false;
    const incomingRequest = c.status === 'request' && c.requestedById !== userId;
    return folder === 'requests' ? incomingRequest : !incomingRequest;
  });
  if (convs.length === 0) return [];
  const ids = convs.map((c) => c.id);
  const lastRows = await db.$queryRaw<LastRow[]>`
    SELECT DISTINCT ON ("conversationId") "conversationId", "senderId", "text", "imageId", "hiddenAt"
    FROM "Message" WHERE "conversationId" = ANY(${ids}) ORDER BY "conversationId", "createdAt" DESC`;
  const last = new Map(lastRows.map((r) => [r.conversationId, r]));
  const withMessages = convs.filter((c) => last.has(c.id)).slice(0, 50);
  const people = await peers(withMessages.map((c) => otherOf(c, userId)));
  return Promise.all(
    withMessages.map(async (c) => {
      const l = last.get(c.id)!;
      const since = readAt.get(c.id);
      const unread = await db.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          hiddenAt: null,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
      });
      return {
        id: c.id,
        other: people.get(otherOf(c, userId)) ?? { id: otherOf(c, userId), displayName: '', kiotName: null, avatarUrl: null },
        status: c.status as 'request' | 'active',
        requestedByMe: c.requestedById === userId,
        last: {
          text: l.hiddenAt ? null : l.text,
          kind: l.hiddenAt ? 'hidden' : l.text ? 'text' : l.imageId ? 'image' : 'product',
          fromMe: l.senderId === userId,
        },
        lastMessageAt: c.lastMessageAt.toISOString(),
        unread,
      };
    }),
  );
}

export type ConversationDetail = {
  id: string;
  other: ConversationPeer;
  status: 'request' | 'active';
  requestedByMe: boolean;
  otherReadAt: string | null;
};

export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDetail | null> {
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || !isMember(c, userId)) return null;
  const otherId = otherOf(c, userId);
  const [people, otherMember] = await Promise.all([
    peers([otherId]),
    db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: otherId } },
    }),
  ]);
  return {
    id: c.id,
    other: people.get(otherId) ?? { id: otherId, displayName: '', kiotName: null, avatarUrl: null },
    status: c.status as 'request' | 'active',
    requestedByMe: c.requestedById === userId,
    otherReadAt: otherMember?.lastReadAt?.toISOString() ?? null,
  };
}

// 50 tin gần nhất (hoặc các tin sau một tin cho trước, cho SSE). Không phải thành viên thì null.
export async function getMessages(
  userId: string,
  conversationId: string,
  opts: { after?: string | null } = {},
): Promise<MessageView[] | null> {
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || !isMember(c, userId)) return null;
  if (opts.after) {
    const after = await db.message.findFirst({
      where: { id: opts.after, conversationId },
      select: { createdAt: true },
    });
    const rows = await db.message.findMany({
      where: { conversationId, ...(after ? { createdAt: { gt: after.createdAt } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return toViews(rows);
  }
  const rows = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return toViews(rows.reverse());
}

export async function markRead(userId: string, conversationId: string): Promise<void> {
  await db.conversationMember.updateMany({ where: { conversationId, userId }, data: { lastReadAt: now() } });
}

export async function acceptRequest(userId: string, conversationId: string): Promise<{ ok: boolean }> {
  const c = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!c || !isMember(c, userId) || c.status !== 'request' || c.requestedById === userId)
    return { ok: false };
  await db.conversation.update({ where: { id: c.id }, data: { status: 'active', acceptedAt: now() } });
  return { ok: true };
}

export async function deleteConversation(userId: string, conversationId: string): Promise<{ ok: boolean }> {
  const { count } = await db.conversationMember.updateMany({
    where: { conversationId, userId },
    data: { hiddenAt: now() },
  });
  return { ok: count === 1 };
}

// Số tin chưa đọc cho nút Hộp thư (không tính tin bị ẩn, cuộc mình đã xoá phía mình, người mình đã chặn).
export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM "Message" m
    JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId" AND cm."userId" = ${userId}
    WHERE m."senderId" <> ${userId} AND m."hiddenAt" IS NULL AND cm."hiddenAt" IS NULL
      AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
      AND NOT EXISTS (SELECT 1 FROM "MessageBlock" b WHERE b."blockerId" = ${userId} AND b."blockedId" = m."senderId")`;
  return row?.n ?? 0;
}
