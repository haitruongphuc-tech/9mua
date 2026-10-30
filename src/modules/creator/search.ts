import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { allWordsMatch, normalizeSearchText } from '@/lib/search-text';
import type { VideoThumb } from './profile';

// Tìm video theo chú thích và hashtag (SPEC-social.md bổ sung 30/10, A3): chỉ video đang lên feed (đã đăng, không phải
// Story, tài khoản không bị khoá), xếp theo điểm feed. Chú thích phải có đủ các từ (không cần đúng thứ tự); "thanh
// long" ra cả video có #thanhlong.
export async function searchVideos(query: string, limit: number): Promise<VideoThumb[]> {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const tag = q.replace(/ /g, '');
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
    WHERE v.status = 'ready' AND v.kind = 'video' AND u."lockedAt" IS NULL
      AND (${allWordsMatch(Prisma.sql`public.search_norm(v.caption)`, q)} OR ${tag} = ANY(v.hashtags))
    ORDER BY v.score DESC, v."readyAt" DESC
    LIMIT ${limit}`;
  if (rows.length === 0) return [];
  const videos = await db.video.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
  const authors = await db.user.findMany({
    where: { id: { in: [...new Set(videos.map((v) => v.authorId))] } },
    select: { id: true, displayName: true },
  });
  const byId = new Map(videos.map((v) => [v.id, v]));
  const name = new Map(authors.map((a) => [a.id, a.displayName]));
  return rows.flatMap((r) => {
    const v = byId.get(r.id);
    return v
      ? [
          {
            id: v.id,
            posterUrl: v.posterUrl,
            caption: v.caption,
            views: v.views,
            likes: v.likes,
            authorName: name.get(v.authorId) ?? '',
          },
        ]
      : [];
  });
}
