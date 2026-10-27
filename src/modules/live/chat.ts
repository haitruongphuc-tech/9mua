import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getLive, pinnable } from './session';

// Chat, tim, ghim sản phẩm trong buổi live (SPEC-live.md mục 5–7).
export const MAX_CHAT = 150;
export const CHAT_INTERVAL_MS = 3_000;
export const MAX_HEARTS_PER_SEC = 10;
export const CHAT_KEEP_DAYS = 30;

// Không cho gửi link trong chat (chống lừa đảo): http(s)://, www., tên miền dạng abc.com/xyz.vn…
const LINK =
  /(https?:\/\/|www\.|\b[\p{L}\p{N}-]+\.(com|vn|net|org|info|io|me|co|link|xyz|shop|store|app|ly|gl|cc|tk)\b)/iu;

export function hasLink(text: string): boolean {
  return LINK.test(text);
}

type ChatResult =
  | { ok: true; id: string }
  | { ok: false; error: 'NOT_LIVE' | 'EMPTY' | 'TOO_LONG' | 'LINK' | 'TOO_FAST' | 'BANNED' };

export async function sendChat(liveId: string, userId: string, raw: string): Promise<ChatResult> {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  if (text.length > MAX_CHAT) return { ok: false, error: 'TOO_LONG' };
  if (hasLink(text)) return { ok: false, error: 'LINK' };
  const live = await getLive(liveId);
  if (!live || live.status !== 'live') return { ok: false, error: 'NOT_LIVE' };
  if (await db.liveChatBan.findUnique({ where: { liveId_userId: { liveId, userId } } }))
    return { ok: false, error: 'BANNED' };
  return db.$transaction(async (tx) => {
    // Khoá theo người gửi: 1 tin mỗi 3 giây kể cả khi bấm gửi liên tục.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`chat:${userId}`}))`;
    const at = now();
    const recent = await tx.liveChatMessage.count({
      where: { userId, liveId, createdAt: { gt: new Date(at.getTime() - CHAT_INTERVAL_MS) } },
    });
    if (recent) return { ok: false as const, error: 'TOO_FAST' as const };
    const msg = await tx.liveChatMessage.create({ data: { liveId, userId, text, createdAt: at } });
    return { ok: true as const, id: msg.id };
  });
}

async function ownLive(liveId: string, ownerId: string) {
  const live = await getLive(liveId);
  return live && live.hostUserId === ownerId ? live : null;
}

export async function hideChat(messageId: string, ownerId: string): Promise<{ ok: boolean }> {
  const msg = await db.liveChatMessage.findUnique({ where: { id: messageId } });
  if (!msg || !(await ownLive(msg.liveId, ownerId))) return { ok: false };
  await db.liveChatMessage.update({ where: { id: messageId }, data: { hiddenAt: now(), hiddenBy: ownerId } });
  return { ok: true };
}

export async function banFromChat(liveId: string, ownerId: string, userId: string): Promise<{ ok: boolean }> {
  if (!(await ownLive(liveId, ownerId)) || userId === ownerId) return { ok: false };
  await db.liveChatBan.upsert({
    where: { liveId_userId: { liveId, userId } },
    create: { liveId, userId, createdAt: now() },
    update: {},
  });
  await db.liveChatMessage.updateMany({
    where: { liveId, userId, hiddenAt: null },
    data: { hiddenAt: now(), hiddenBy: ownerId },
  });
  return { ok: true };
}

// Tối đa 10 tim mỗi giây mỗi người (đếm trong RAM; web chạy 1 tiến trình).
const heartWindow = new Map<string, { second: number; count: number }>();

export async function sendHearts(
  liveId: string,
  userId: string,
  count: number,
): Promise<{ hearts: number } | null> {
  const live = await getLive(liveId);
  if (!live || live.status !== 'live') return null;
  const second = Math.floor(now().getTime() / 1000);
  const key = `${liveId}:${userId}`;
  const w = heartWindow.get(key);
  const used = w && w.second === second ? w.count : 0;
  const take = Math.max(0, Math.min(Math.floor(count) || 0, MAX_HEARTS_PER_SEC - used));
  heartWindow.set(key, { second, count: used + take });
  if (heartWindow.size > 5_000)
    for (const [k, v] of heartWindow) if (v.second < second) heartWindow.delete(k);
  if (take === 0) return { hearts: live.hearts };
  const updated = await db.liveSession.update({
    where: { id: liveId },
    data: { hearts: { increment: take } },
  });
  return { hearts: updated.hearts };
}

export async function pinProduct(
  liveId: string,
  ownerId: string,
  productId: string | null,
): Promise<{ ok: boolean }> {
  const live = await ownLive(liveId, ownerId);
  if (!live || (live.status !== 'live' && live.status !== 'created')) return { ok: false };
  if (productId && !(await pinnable(productId))) return { ok: false };
  await db.liveSession.update({ where: { id: liveId }, data: { pinnedProductId: productId } });
  return { ok: true };
}

// Chat không phải sổ tiền: tự xoá sau 30 ngày (worker gọi mỗi giờ).
export async function cleanupLiveChat(): Promise<number> {
  const { count } = await db.liveChatMessage.deleteMany({
    where: { createdAt: { lt: new Date(now().getTime() - CHAT_KEEP_DAYS * 86_400_000) } },
  });
  return count;
}
