import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hydratePosts, hydrateVideos, type FeedVideo, type PostView } from '@/modules/creator';

// Kỷ niệm "Ngày này năm trước" (SPEC-social.md V5.7 mục 2): video hoặc bài của chính mình đăng cùng ngày tháng ở các
// năm trước (giờ Việt Nam). Chỉ chủ tài khoản thấy; tắt được trong Cài đặt.
export async function memoriesOf(userId: string): Promise<{ videos: FeedVideo[]; posts: PostView[] } | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { showMemories: true } });
  if (!u?.showMemories) return null;
  const vn = new Date(now().getTime() + 7 * 3_600_000);
  const mmdd = vn.toISOString().slice(5, 10);
  const yearStart = new Date(`${vn.getUTCFullYear()}-01-01T00:00:00+07:00`);
  const [videos, posts] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Video" WHERE "authorId" = ${userId} AND status = 'ready' AND kind = 'video'
        AND "createdAt" < ${yearStart}
        AND to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'MM-DD') = ${mmdd}
      ORDER BY "createdAt" DESC LIMIT 12`,
    db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Post" WHERE "authorId" = ${userId} AND status = 'ready'
        AND "createdAt" < ${yearStart}
        AND to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', 'MM-DD') = ${mmdd}
      ORDER BY "createdAt" DESC LIMIT 12`,
  ]);
  return {
    videos: await hydrateVideos(
      videos.map((v) => v.id),
      { userId },
    ),
    posts: await hydratePosts(
      posts.map((p) => p.id),
      { userId },
    ),
  };
}

export async function setShowMemories(userId: string, on: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { showMemories: on } });
}
