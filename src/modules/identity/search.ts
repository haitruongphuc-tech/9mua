import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { allWordsMatch, normalizeSearchText } from '@/lib/search-text';

export type UserSearchHit = { id: string; displayName: string; avatarUrl: string | null; followers: number };

// Tìm tài khoản theo tên hiển thị (SPEC-social.md bổ sung 30/10, A3): không dấu, không phân biệt hoa thường. Tên bắt đầu
// bằng từ khoá lên trước, sau đó người nhiều người theo dõi. Tên phải có đủ các từ, không cần đúng thứ tự. Không hiện tài khoản bị khoá và tài khoản admin.
export async function searchPublicUsers(query: string, limit: number): Promise<UserSearchHit[]> {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const rows = await db.$queryRaw<{ id: string; displayName: string; avatarUrl: string | null; followers: bigint }[]>`
    SELECT u.id, u."displayName", u."avatarUrl",
      (SELECT count(*) FROM "Follow" f WHERE f."followeeId" = u.id) AS followers
    FROM "User" u
    WHERE u."lockedAt" IS NULL AND u.role = 'user'
      AND ${allWordsMatch(Prisma.sql`public.search_norm(u."displayName")`, q)}
    ORDER BY (public.search_norm(u."displayName") LIKE ${`${q}%`}) DESC, followers DESC, u."createdAt" DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, followers: Number(r.followers) }));
}
