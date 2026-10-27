import { db, type Tx } from './db';

// Cài đặt CEO chỉnh được trong trang admin. Giá trị lưu dạng chuỗi, đọc kèm mặc định.
export const SETTING_DEFAULTS = {
  kiot_fee_vnd: '26000', // tự tính từ kiot_fee_usd_cents × tỷ giá Vietcombank mỗi sáng (SPEC-billing.md bổ sung 27/10)
  kiot_fee_usd_cents: '100', // 1,00 USD/năm
  platform_fee_bp: '500', // 5% = 500 basis point
  payout_min_vnd: '50000',
  payout_fee_vnd: '0',
  payout_auto_enabled: 'true',
  payout_auto_max_per_request: '5000000',
  payout_auto_max_per_kiot_day: '10000000',
  payout_auto_daily_cap: '50000000',
  // Tài khoản Free và voucher mở Kiot (SPEC-social.md mục 7–8)
  social_free_daily_limit: '50',
  social_voucher_threshold: '100',
  social_voucher_enabled: 'true',
  // AI Studio (SPEC-ai.md mục 8)
  ai_enabled: 'true',
  ai_monthly_budget_vnd: '500000',
  ai_text_per_day: '10',
  ai_image_per_day: '3',
  // Tỉ giá USD dùng để quy chi phí AI (giá AI tính bằng USD) ra VNĐ.
  usd_vnd_rate: '26500',
  // Nội dung CEO sửa ở /admin/noi-dung (SPEC-admin.md bổ sung 27/10), lưu dạng JSON.
  slogans_json: '{}', // { "home": { "vi": "...", "en": "..." }, ... } — trống thì dùng từ điển
  legal_info_json: '{}', // xem src/lib/legal.ts
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey, tx: Tx | typeof db = db): Promise<string> {
  const row = await tx.setting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function getIntSetting(key: SettingKey, tx: Tx | typeof db = db): Promise<number> {
  const value = Number(await getSetting(key, tx));
  if (!Number.isFinite(value)) throw new Error(`Cài đặt ${key} không phải số`);
  return value;
}

export async function setSetting(key: SettingKey, value: string, actorId: string | null): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value, updatedById: actorId },
    update: { value, updatedById: actorId },
  });
}
