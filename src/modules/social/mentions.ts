import { isBlockedEither } from '@/lib/blocks';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';
import { notifyKey } from '@/lib/notifications';

// Nhắc tên @ (SPEC-social.md V5.4 mục 2): trong bình luận, chú thích video, chữ bài viết. Tối đa 10 lần mỗi nội dung.
// Người được nhắc nhận thông báo, theo cài đặt "Ai được nhắc tên tôi" (everyone | following | nobody); không nhắc được
// người đã chặn nhau.
export const MAX_MENTIONS = 10;
export const MENTION_POLICIES = ['everyone', 'following', 'nobody'] as const;
export type MentionPolicy = (typeof MENTION_POLICIES)[number];
export type MentionSource = 'comment' | 'video' | 'post' | 'post_comment';

// @tên theo luật @handle (C69): chữ thường, số, dấu chấm, gạch dưới, 3–30 ký tự.
const MENTION_RE = /(^|[^\p{L}\p{N}_.@])@([a-z0-9._]{3,30})/giu;

export function parseMentions(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    const h = m[2]!.toLowerCase().replace(/\.+$/, '');
    if (h.length >= 3 && !out.includes(h)) out.push(h);
    if (out.length >= MAX_MENTIONS) break;
  }
  return out;
}

async function allowed(byUserId: string, target: { id: string; mentionPolicy: string }): Promise<boolean> {
  if (target.id === byUserId) return false;
  if (target.mentionPolicy === 'nobody') return false;
  if (await isBlockedEither(byUserId, target.id)) return false;
  if (target.mentionPolicy === 'following')
    return Boolean(await db.follow.findFirst({ where: { followerId: target.id, followeeId: byUserId } }));
  return true;
}

// Lưu nhắc tên và gửi thông báo một lần cho mỗi người mỗi nội dung. Trả về số người được báo.
export async function recordMentions(
  source: { type: MentionSource; id: string; url: string },
  byUserId: string,
  text: string,
): Promise<number> {
  const handles = parseMentions(text);
  if (!handles.length || !(await isFeatureOn('social_more'))) return 0;
  const users = await db.user.findMany({
    where: { handle: { in: handles }, lockedAt: null },
    select: { id: true, mentionPolicy: true },
  });
  const by = await db.user.findUnique({ where: { id: byUserId }, select: { displayName: true } });
  let sent = 0;
  for (const u of users) {
    if (!(await allowed(byUserId, u))) continue;
    const created = await db.mention
      .create({
        data: { sourceType: source.type, sourceId: source.id, userId: u.id, byUserId, createdAt: now() },
      })
      .catch(() => null); // đã nhắc trong nội dung này (sửa lại chữ) thì không báo lần nữa
    if (!created) continue;
    await notifyKey(
      u.id,
      'notify.mentioned',
      { name: by?.displayName ?? '9MUA', detail: text.slice(0, 80) },
      source.url,
    );
    sent += 1;
  }
  return sent;
}

// Gợi ý khi gõ @: người mình follow trước, rồi tìm theo @tên và tên hiển thị.
export async function mentionSuggestions(
  userId: string,
  q: string,
): Promise<{ id: string; handle: string; displayName: string; avatarUrl: string | null }[]> {
  const query = q.replace(/^@/, '').trim().toLowerCase().slice(0, 30);
  const follows = await db.follow.findMany({
    where: { followerId: userId },
    select: { followeeId: true },
    take: 500,
  });
  const followed = new Set(follows.map((f) => f.followeeId));
  const rows = await db.user.findMany({
    where: {
      lockedAt: null,
      handle: { not: null },
      id: { not: userId },
      ...(query
        ? {
            OR: [
              { handle: { startsWith: query } },
              { displayName: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : { id: { in: [...followed] } }),
    },
    select: { id: true, handle: true, displayName: true, avatarUrl: true },
    take: 50,
  });
  return rows
    .sort((a, b) => Number(followed.has(b.id)) - Number(followed.has(a.id)))
    .slice(0, 8)
    .map((u) => ({ id: u.id, handle: u.handle!, displayName: u.displayName, avatarUrl: u.avatarUrl }));
}

export async function setMentionPolicy(userId: string, policy: string): Promise<boolean> {
  if (!MENTION_POLICIES.includes(policy as MentionPolicy)) return false;
  await db.user.update({ where: { id: userId }, data: { mentionPolicy: policy } });
  return true;
}

export async function mentionPolicyOf(userId: string): Promise<MentionPolicy> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { mentionPolicy: true } });
  return MENTION_POLICIES.includes(u?.mentionPolicy as MentionPolicy)
    ? (u!.mentionPolicy as MentionPolicy)
    : 'everyone';
}
