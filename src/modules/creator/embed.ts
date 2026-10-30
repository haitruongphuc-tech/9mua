import { db } from '@/lib/db';

// Trang nhúng /nhung/<id> (SPEC-creator.md V5.7 mục 2): chỉ video công khai đang trên 9MUA, người đăng không bị khoá.
export async function embedVideo(videoId: string): Promise<{
  id: string;
  fileUrl: string;
  posterUrl: string | null;
  caption: string;
  authorName: string;
} | null> {
  const v = await db.video.findFirst({
    where: { id: videoId, status: 'ready', kind: 'video', visibility: 'public', fileUrl: { not: null } },
    select: { id: true, fileUrl: true, posterUrl: true, caption: true, authorId: true },
  });
  if (!v?.fileUrl) return null;
  const author = await db.user.findUnique({
    where: { id: v.authorId },
    select: { lockedAt: true, handle: true, displayName: true },
  });
  if (!author || author.lockedAt) return null;
  return {
    id: v.id,
    fileUrl: v.fileUrl,
    posterUrl: v.posterUrl,
    caption: v.caption,
    authorName: author.handle ?? author.displayName,
  };
}
