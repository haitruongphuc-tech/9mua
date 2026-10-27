import { formatVnd } from '@/lib/format';
import { getLegalInfo } from '@/lib/legal';
import { getIntSetting } from '@/lib/settings';
import { getKiotFee } from '@/modules/billing';

// Số liệu thật điền vào trang chính sách: thông tin công ty (/admin/noi-dung) và các mức phí (/admin/cai-dat).
export async function policyValues(): Promise<Record<string, string>> {
  const [legal, kiotFee, feeBp, payoutMin, payoutFee] = await Promise.all([
    getLegalInfo(),
    getKiotFee(),
    getIntSetting('platform_fee_bp'),
    getIntSetting('payout_min_vnd'),
    getIntSetting('payout_fee_vnd'),
  ]);
  return {
    ...legal,
    kiotFee: formatVnd(kiotFee),
    platformFee: `${(feeBp / 100).toLocaleString('vi-VN')}%`,
    payoutMin: formatVnd(payoutMin),
    payoutFee: formatVnd(payoutFee),
  };
}

export const mapUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
