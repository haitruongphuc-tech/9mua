import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { allWordsMatch, normalizeSearchText } from '@/lib/search-text';

export type UserSearchHit = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number;
  handle: string | null;
};

// Tìm tài khoản theo tên hiển thị (SPEC-social.md bổ sung 30/10, A3) và theo @tên (SPEC-identity.md V5.1): không dấu, không
// phân biệt hoa thường. Đúng @tên lên đầu, rồi tên bắt đầu bằng từ khoá, rồi người nhiều người theo dõi. Tên phải có đủ các
// từ, không cần đúng thứ tự. Không hiện tài khoản bị khoá và tài khoản admin.
export async function searchPublicUsers(query: string, limit: number): Promise<UserSearchHit[]> {
  // Gõ "@..." là tìm đúng theo @tên; không có "@" thì tìm cả tên hiển thị lẫn @tên.
  const onlyHandle = query.trim().startsWith('@');
  const q = onlyHandle ? '' : normalizeSearchText(query);
  const handle = query.trim().replace(/^@/, '').toLowerCase();
  const byHandle = /^[a-z0-9._]{2,24}$/.test(handle);
  if (!q && !byHandle) return [];
  const handlePrefix = `${handle.replace(/[\\%_]/g, '\\$&')}%`;
  const match = [
    ...(q ? [allWordsMatch(Prisma.sql`public.search_norm(u."displayName")`, q)] : []),
    ...(byHandle ? [Prisma.sql`u.handle LIKE ${handlePrefix}`] : []),
  ];
  const rows = await db.$queryRaw<
    { id: string; displayName: string; avatarUrl: string | null; handle: string | null; followers: bigint }[]
  >`
    SELECT u.id, u."displayName", u."avatarUrl", u.handle,
      (SELECT count(*) FROM "Follow" f WHERE f."followeeId" = u.id) AS followers
    FROM "User" u
    WHERE u."lockedAt" IS NULL AND u.role = 'user' AND (${Prisma.join(match, ' OR ')})
    ORDER BY COALESCE(u.handle = ${handle}, false) DESC, (public.search_norm(u."displayName") LIKE ${`${q}%`}) DESC,
      followers DESC, u."createdAt" DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, followers: Number(r.followers) }));
}
