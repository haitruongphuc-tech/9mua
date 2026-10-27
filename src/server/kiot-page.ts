import { getCreatorProfile } from '@/modules/creator';
import { countPublicProducts, getPublicKiot, kiotOwnerId } from '@/modules/kiot';
import { kiotSoldTotal } from '@/modules/marketplace';
import { followStats, getSocialLinks, kiotHeartStats, toggleFollow, toggleKiotHeart } from '@/modules/social';

// Ghép dữ liệu trang Kiot V4 từ nhiều module (SPEC-kiot.md bổ sung 27/10). Mọi số đều đếm thật.
export async function loadKiotPage(slug: string, viewerId: string | null) {
  const found = await getPublicKiot(slug, viewerId);
  if (!found) return null;
  const { kiot, preview, owner } = found;
  const [follow, hearts, products, sold, socialLinks, profile] = await Promise.all([
    followStats(owner.id, viewerId ?? undefined),
    kiotHeartStats(kiot.id, owner.id, viewerId ?? undefined),
    countPublicProducts(kiot.id),
    kiotSoldTotal(kiot.id),
    getSocialLinks(owner.id),
    getCreatorProfile(owner.id),
  ]);
  return {
    kiot,
    preview,
    owner: { displayName: owner.displayName },
    stats: { followers: follow.followers, hearts: hearts.hearts, products, sold },
    viewer: {
      following: follow.isFollowing,
      hearted: hearts.hearted,
      isOwner: viewerId !== null && viewerId === owner.id,
    },
    socialLinks,
    videos: profile?.videos ?? [],
  };
}

export type KiotPageData = NonNullable<Awaited<ReturnType<typeof loadKiotPage>>>;

// Nút Follow trên trang Kiot: follow chủ Kiot mà không cần đưa id chủ xuống trình duyệt.
export async function followKiotOwner(userId: string, kiotId: string) {
  const ownerId = await kiotOwnerId(kiotId);
  if (!ownerId) return { ok: false as const, error: 'NOT_FOUND' as const };
  return toggleFollow(userId, ownerId);
}

// Nút Tim trên trang Kiot. Số trả về là số "Tim" hiển thị: tim Kiot + tổng lượt thích video của chủ Kiot.
export async function heartKiot(userId: string, kiotId: string) {
  const ownerId = await kiotOwnerId(kiotId);
  if (!ownerId) return { ok: false as const, error: 'NOT_FOUND' as const };
  const result = await toggleKiotHeart(userId, kiotId);
  if (!result.ok) return result;
  const { hearts } = await kiotHeartStats(kiotId, ownerId);
  return { ok: true as const, hearted: result.hearted, hearts };
}
