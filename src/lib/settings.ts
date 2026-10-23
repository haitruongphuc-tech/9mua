import { db, type Tx } from './db';

// Cài đặt CEO chỉnh được trong trang admin. Giá trị lưu dạng chuỗi, đọc kèm mặc định.
export const SETTING_DEFAULTS = {
  kiot_fee_vnd: '26000',
  platform_fee_bp: '500', // 5% = 500 basis point
  payout_min_vnd: '50000',
  payout_fee_vnd: '0',
  payout_auto_enabled: 'true',
  payout_auto_max_per_request: '5000000',
  payout_auto_max_per_kiot_day: '10000000',
  payout_auto_daily_cap: '50000000',
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
