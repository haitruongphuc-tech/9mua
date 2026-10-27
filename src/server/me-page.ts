import { unreadCount } from '@/lib/notifications';
import { getIntSetting, getSetting } from '@/lib/settings';
import { countPublicProducts, getKiotByOwner, kiotStatus } from '@/modules/kiot';
import {
  followStats,
  freeStatus,
  getSocialLinks,
  getVoucher,
  likedVideoCount,
  savedVideos,
} from '@/modules/social';

// Ghép dữ liệu trang Tôi kiểu V4 (SPEC-social.md mục 4, 7, 8). Mọi số đều đếm thật.
export async function loadMePage(user: { id: string; role: 'user' | 'admin' }) {
  const [follow, free, liked, threshold, enabled, voucher, kiot, notifications, links, saved] =
    await Promise.all([
      followStats(user.id),
      freeStatus(user.id),
      likedVideoCount(user.id),
      getIntSetting('social_voucher_threshold'),
      getSetting('social_voucher_enabled'),
      getVoucher(user.id),
      getKiotByOwner(user.id),
      unreadCount(user.id),
      getSocialLinks(user.id),
      savedVideos({ userId: user.id }, 12),
    ]);
  const status = kiot ? kiotStatus(kiot) : null;
  return {
    role:
      user.role === 'admin'
        ? ('admin' as const)
        : status === 'active'
          ? ('owner' as const)
          : ('free' as const),
    follow: { followers: follow.followers, following: follow.following },
    free: free.isFree ? { used: free.used, limit: free.limit } : null,
    voucher: {
      enabled: enabled === 'true',
      liked,
      threshold,
      status: !voucher
        ? ('none' as const)
        : voucher.usable
          ? ('usable' as const)
          : voucher.usedAt
            ? ('used' as const)
            : ('revoked' as const),
    },
    kiot:
      kiot && status
        ? { name: kiot.name, slug: kiot.slug, status, products: await countPublicProducts(kiot.id) }
        : null,
    notifications,
    socialCount: Object.keys(links).length,
    saved,
  };
}

export type MePageData = Awaited<ReturnType<typeof loadMePage>>;
