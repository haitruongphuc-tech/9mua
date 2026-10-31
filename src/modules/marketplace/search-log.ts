import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { getSetting } from '@/lib/settings';
import { cached } from '@/lib/ttl-cache';
import { normalizeQuery } from './query';

// Gợi ý khi gõ, lịch sử tìm, từ khoá đang hot (SPEC-marketplace.md V5.4, công tắc search_more). SearchLog không lưu vị trí.
export const MAX_SUGGESTIONS = 8;
export const HISTORY_SIZE = 20;
const HOT_DAYS = 7;
const HOT_MIN_PEOPLE = 5;
const KEEP_DAYS = 90;
const DAY = 86_400_000;

export type Suggestion = { kind: 'product' | 'kiot' | 'hashtag' | 'user'; text: string; href: string };

// Ghi một lần tìm (người đã đăng nhập hoặc mã ẩn danh). Từ khoá đã chuẩn hoá (bỏ dấu, chữ thường).
export async function logSearch(input: {
  userId?: string;
  anonId?: string;
  q: string;
  tab: string;
  results: number;
}): Promise<void> {
  const query = normalizeQuery(input.q).slice(0, 100);
  if (!query || (!input.userId && !input.anonId)) return;
  await db.searchLog.create({
    data: {
      userId: input.userId ?? null,
      anonId: input.userId ? null : (input.anonId ?? null),
      query,
      tab: input.tab.slice(0, 20),
      results: Math.max(0, Math.floor(input.results)),
      createdAt: now(),
    },
  });
}

// 20 từ khoá gần nhất của tôi (không trùng).
export async function searchHistory(userId: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ query: string }[]>`
    SELECT query FROM "SearchLog" WHERE "userId" = ${userId} AND "hiddenAt" IS NULL
    GROUP BY query ORDER BY max("createdAt") DESC LIMIT ${HISTORY_SIZE}`;
  return rows.map((r) => r.query);
}

// Xoá một từ khoá (q) hoặc xoá hết lịch sử của tôi. Chỉ ẩn khỏi lịch sử; vẫn tính vào từ khoá hot.
export async function clearSearchHistory(userId: string, q?: string): Promise<void> {
  await db.searchLog.updateMany({
    where: { userId, hiddenAt: null, ...(q ? { query: normalizeQuery(q) } : {}) },
    data: { hiddenAt: now() },
  });
}

async function hiddenWords(): Promise<string[]> {
  try {
    const v = JSON.parse(await getSetting('search_hidden_json')) as { words?: unknown };
    return Array.isArray(v.words)
      ? v.words.filter((w): w is string => typeof w === 'string').map(normalizeQuery)
      : [];
  } catch {
    return [];
  }
}

// 10 từ khoá nhiều người khác nhau tìm nhất 7 ngày qua (tối thiểu 5 người), bỏ từ CEO không cho hiện.
export function hotKeywords(): Promise<string[]> {
  return cached('hot-keywords', 300, async () => {
    const since = new Date(now().getTime() - HOT_DAYS * DAY);
    const rows = await db.$queryRaw<{ query: string }[]>`
      SELECT query FROM "SearchLog" WHERE "createdAt" >= ${since}
      GROUP BY query HAVING count(DISTINCT COALESCE("userId", "anonId")) >= ${HOT_MIN_PEOPLE}
      ORDER BY count(DISTINCT COALESCE("userId", "anonId")) DESC, query LIMIT 30`;
    const hidden = await hiddenWords();
    return rows
      .map((r) => r.query)
      .filter((q) => !hidden.some((w) => w && q.includes(w)))
      .slice(0, 10);
  });
}

// Gợi ý khi gõ: tên sản phẩm, tên Kiot, hashtag, @tên — mỗi loại khớp đầu từ, tổng tối đa 8.
export async function suggest(raw: string): Promise<Suggestion[]> {
  const q = normalizeQuery(raw).slice(0, 50);
  if (q.length < 2) return [];
  const starts = `(^| )${q}`;
  const tag = q.replace(/ /g, '');
  const at = now();
  const [products, kiots, tags, users] = await Promise.all([
    db.$queryRaw<{ name: string }[]>`
      SELECT DISTINCT ON (p."searchName") p.name FROM "Product" p JOIN "Kiot" k ON k.id = p."kiotId"
      WHERE p."searchName" ~ ${starts} AND p.visible = true AND p."deletedAt" IS NULL AND p."hiddenByAdminAt" IS NULL
        AND k."activeUntil" > ${at} AND k."lockedAt" IS NULL
      ORDER BY p."searchName" LIMIT 4`,
    db.$queryRaw<{ name: string; slug: string }[]>`
      SELECT name, slug FROM "Kiot" WHERE search_norm(name) ~ ${starts} AND "activeUntil" > ${at} AND "lockedAt" IS NULL
      ORDER BY name LIMIT 2`,
    db.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT tag FROM "Video" v, unnest(v.hashtags) AS tag
      WHERE v.status = 'ready' AND v.visibility = 'public' AND tag LIKE ${`${tag}%`} LIMIT 2`,
    db.$queryRaw<{ handle: string }[]>`
      SELECT handle FROM "User" WHERE handle LIKE ${`${tag}%`} AND "lockedAt" IS NULL AND role = 'user' LIMIT 2`,
  ]);
  const out: Suggestion[] = [
    ...products.map((p) => ({
      kind: 'product' as const,
      text: p.name,
      href: `/tim-kiem?q=${encodeURIComponent(p.name)}`,
    })),
    ...kiots.map((k) => ({
      kind: 'kiot' as const,
      text: k.name,
      href: `/tim-kiem?q=${encodeURIComponent(k.name)}&tab=kiot`,
    })),
    ...tags.map((t) => ({
      kind: 'hashtag' as const,
      text: `#${t.tag}`,
      href: `/hashtag/${encodeURIComponent(t.tag)}`,
    })),
    ...users.map((u) => ({ kind: 'user' as const, text: `@${u.handle}`, href: `/@${u.handle}` })),
  ];
  return out.slice(0, MAX_SUGGESTIONS);
}

// Việc hằng ngày: xoá dòng cũ hơn 90 ngày.
export async function cleanupSearchLog(): Promise<number> {
  const r = await db.searchLog.deleteMany({
    where: { createdAt: { lt: new Date(now().getTime() - KEEP_DAYS * DAY) } },
  });
  return r.count;
}
