import { getSetting } from '@/lib/settings';
import { kiotBadges, kiotOwnerId, type KiotBadges } from '@/modules/kiot';
import { isBankVerified } from '@/modules/payouts';

// Huy hiệu Kiot (SPEC-kiot.md V5.2 mục 4): ghép dữ liệu nguồn gốc (kiot) và ngân hàng (payouts) ở tầng ứng dụng.
export async function badgesForKiot(kiotId: string): Promise<KiotBadges> {
  const ownerId = await kiotOwnerId(kiotId);
  return kiotBadges(kiotId, ownerId ? await isBankVerified(ownerId) : false);
}

export type BadgeStyle = {
  names: { origin: string; bank: string; video: string };
  colors: [string, string, string];
};

export const BADGE_DEFAULTS: BadgeStyle = {
  names: { origin: 'Đã xác thực nguồn gốc', bank: 'Đã xác thực ngân hàng', video: 'Đã xác thực video' },
  colors: ['#16a34a', '#eab308', '#9333ea'], // 1 = Xanh, 2 = Vàng, 3 = Tím
};

// Tên và màu huy hiệu CEO đổi ở /admin/noi-dung (setting badges_json); trống thì dùng mặc định.
export async function badgeStyle(): Promise<BadgeStyle> {
  try {
    const v = JSON.parse(await getSetting('badges_json')) as Partial<BadgeStyle>;
    return {
      names: { ...BADGE_DEFAULTS.names, ...(v.names ?? {}) },
      colors:
        Array.isArray(v.colors) && v.colors.length === 3
          ? (v.colors as BadgeStyle['colors'])
          : BADGE_DEFAULTS.colors,
    };
  } catch {
    return BADGE_DEFAULTS;
  }
}
