import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { deleteVideo } from './moderation';
import { deletePost } from './posts';

// Tài khoản tự xoá hết 30 ngày chờ (SPEC-identity.md V5.3 mục 4): gỡ và xoá file mọi video (cả Story), bài viết;
// bình luận thành trống và ẩn. Đơn hàng có món mua từ video vẫn giữ (OrderItem.sourceVideoId chỉ là mã).
export async function purgeUserContent(
  userId: string,
): Promise<{ videos: number; posts: number; comments: number }> {
  const videos = await db.video.findMany({
    where: { authorId: userId, status: { not: 'deleted' } },
    select: { id: true },
  });
  for (const v of videos) await deleteVideo(v.id, userId);
  const posts = await db.post.findMany({
    where: { authorId: userId, status: { not: 'deleted' } },
    select: { id: true },
  });
  for (const p of posts) await deletePost(userId, p.id);
  const t = now();
  const [c1, c2] = await db.$transaction([
    db.comment.updateMany({
      where: { userId },
      data: { text: '', hiddenAt: t, hiddenReason: 'deleted' },
    }),
    db.postComment.updateMany({ where: { userId }, data: { text: '', hiddenAt: t } }),
  ]);
  return { videos: videos.length, posts: posts.length, comments: c1.count + c2.count };
}
