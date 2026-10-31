import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';
import { notifyEvent } from '@/lib/notify-events';
import { likeVideo, toggleLike } from '@/modules/creator';
import { consumeDailyAction } from './limits';
import { checkVoucher } from './voucher';
import { awardLikePoints, type PointAward } from './points';

// Thích video qua module social để áp giới hạn tài khoản Free và tặng voucher (SPEC-social.md mục 7–8).
// mode 'toggle': nút tim; 'like': chạm 2 lần (chỉ thích, không bỏ thích).
export async function heartVideo(
  userId: string,
  videoId: string,
  mode: 'toggle' | 'like',
): Promise<
  | { ok: true; liked: boolean; likes: number; points?: PointAward }
  | { ok: false; error: 'NOT_FOUND' | 'FREE_LIMIT' }
> {
  const already = (await db.videoLike.count({ where: { userId, videoId } })) > 0;
  if (already && mode === 'like') {
    const v = await db.video.findUnique({ where: { id: videoId }, select: { likes: true } });
    return v ? { ok: true, liked: true, likes: v.likes } : { ok: false, error: 'NOT_FOUND' };
  }
  if (!already) {
    const exists = await db.video.count({ where: { id: videoId, status: 'ready' } });
    if (!exists) return { ok: false, error: 'NOT_FOUND' };
    const allowed = await consumeDailyAction(userId);
    if (!allowed.ok) return allowed;
  }
  const r = mode === 'like' ? await likeVideo(videoId, userId) : await toggleLike(videoId, userId);
  if (r.ok && r.liked) await checkVoucher(userId);
  // Có người thích video (SPEC-social.md V5.5): mỗi video tối đa 1 thông báo mỗi giờ, gộp tên.
  if (r.ok && r.liked && !already && (await isFeatureOn('social_more'))) {
    const v = await db.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
    if (v && v.authorId !== userId) {
      const me = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      await notifyEvent({
        userId: v.authorId,
        type: 'like',
        key: 'notify.videoLiked',
        groupedKey: 'notify.videoLikedMany',
        vars: { name: me?.displayName ?? '9MUA' },
        url: `/v/${videoId}`,
        groupKey: `like:video:${videoId}`,
      });
    }
  }
  if (r.ok && r.liked && !already) {
    const v = await db.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
    const points = v ? await awardLikePoints(userId, videoId, v.authorId) : null;
    if (points) return { ...r, points };
  }
  return r;
}

// Tim Kiot (SPEC-social.md mục 6).
export async function toggleKiotHeart(
  userId: string,
  kiotId: string,
): Promise<{ ok: true; hearted: boolean; hearts: number } | { ok: false; error: 'FREE_LIMIT' }> {
  const removed = await db.kiotHeart.deleteMany({ where: { kiotId, userId } });
  let hearted = false;
  if (!removed.count) {
    const allowed = await consumeDailyAction(userId);
    if (!allowed.ok) return allowed;
    await db.kiotHeart.create({ data: { kiotId, userId } }).catch((e) => {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    });
    hearted = true;
  }
  return { ok: true, hearted, hearts: await db.kiotHeart.count({ where: { kiotId } }) };
}

// Số "Tim" trên trang Kiot = tim Kiot + tổng lượt thích video của chủ Kiot.
export async function kiotHeartStats(kiotId: string, ownerId: string, viewerId?: string) {
  const [hearts, likes, mine] = await Promise.all([
    db.kiotHeart.count({ where: { kiotId } }),
    db.video.aggregate({ where: { authorId: ownerId, status: 'ready' }, _sum: { likes: true } }),
    viewerId ? db.kiotHeart.count({ where: { kiotId, userId: viewerId } }) : 0,
  ]);
  return { hearts: hearts + (likes._sum.likes ?? 0), hearted: mine > 0 };
}
