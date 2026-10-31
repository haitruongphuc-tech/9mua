import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { getKiotFee, grantYear, setKiotFee, setKiotFeeUsd } from '@/modules/billing';
import { notifyKey } from '@/lib/notifications';
import { clearProfile, lockUser, requestPasswordReset, resetPassword, unlockUser } from '@/modules/identity';
import { lockKiot, unlockKiot } from '@/modules/kiot';
import { adjustBalance, availableBalance } from '@/modules/payouts';
import { getSetting, setSetting, SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';

export type AdminResult = { ok: true; message?: string } | { ok: false; error: string };

const userSnap = (id: string) =>
  db.user.findUnique({ where: { id }, select: { lockedAt: true, mustChangePassword: true } });
const kiotSnap = (id: string) =>
  db.kiot.findUnique({ where: { id }, select: { lockedAt: true, lockReason: true, activeUntil: true } });

const needReason = (reason: string) =>
  reason.trim().length < 3 ? { ok: false as const, error: 'Hãy ghi lý do.' } : null;

export async function lockUserAccount(adminId: string, userId: string, reason: string): Promise<AdminResult> {
  const missing = needReason(reason);
  if (missing) return missing;
  if (userId === adminId) return { ok: false, error: 'Không tự khoá tài khoản của mình.' };
  const before = await userSnap(userId);
  if (!before) return { ok: false, error: 'Không tìm thấy người dùng.' };
  await lockUser(userId);
  await audit({
    adminId,
    action: 'user.lock',
    targetType: 'user',
    targetId: userId,
    reason,
    before,
    after: await userSnap(userId),
  });
  return { ok: true, message: 'Đã khoá tài khoản và đăng xuất mọi thiết bị.' };
}

export async function unlockUserAccount(adminId: string, userId: string): Promise<AdminResult> {
  const before = await userSnap(userId);
  if (!before) return { ok: false, error: 'Không tìm thấy người dùng.' };
  await unlockUser(userId);
  await audit({
    adminId,
    action: 'user.unlock',
    targetType: 'user',
    targetId: userId,
    before,
    after: await userSnap(userId),
  });
  return { ok: true, message: 'Đã mở khoá tài khoản.' };
}

// Gỡ ảnh đại diện, ảnh bìa và giới thiệu vi phạm (SPEC-social.md bổ sung 30/10, A2); người dùng được báo kèm lý do.
export async function clearUserProfile(
  adminId: string,
  userId: string,
  reason: string,
): Promise<AdminResult> {
  const missing = needReason(reason);
  if (missing) return missing;
  const before = await clearProfile(userId);
  if (!before) return { ok: false, error: 'Không tìm thấy người dùng.' };
  await audit({
    adminId,
    action: 'user.clear_profile',
    targetType: 'user',
    targetId: userId,
    reason,
    before,
    after: { avatarUrl: null, coverUrl: null, bio: null },
  });
  await notifyKey(userId, 'notify.profileCleared', { detail: reason.trim() }, `/creator/${userId}`);
  return { ok: true, message: 'Đã gỡ ảnh đại diện, ảnh bìa và giới thiệu.' };
}

export async function sendResetLink(adminId: string, userId: string): Promise<AdminResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return { ok: false, error: 'Tài khoản không có email — hãy cấp mật khẩu tạm.' };
  await requestPasswordReset(user.email);
  await audit({ adminId, action: 'user.send_reset_link', targetType: 'user', targetId: userId });
  return { ok: true, message: `Đã gửi link đặt lại mật khẩu tới ${user.email}.` };
}

// Mật khẩu tạm chỉ trả về một lần để CEO đọc cho người dùng; KHÔNG ghi vào nhật ký.
export async function issueTempPassword(
  adminId: string,
  userId: string,
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  if (!(await userSnap(userId))) return { ok: false, error: 'Không tìm thấy người dùng.' };
  const { tempPassword } = await resetPassword(userId);
  await audit({ adminId, action: 'user.temp_password', targetType: 'user', targetId: userId });
  return { ok: true, tempPassword };
}

export async function lockKiotAccount(adminId: string, kiotId: string, reason: string): Promise<AdminResult> {
  const missing = needReason(reason);
  if (missing) return missing;
  const before = await kiotSnap(kiotId);
  if (!before) return { ok: false, error: 'Không tìm thấy Kiot.' };
  await lockKiot(kiotId, reason.trim());
  await audit({
    adminId,
    action: 'kiot.lock',
    targetType: 'kiot',
    targetId: kiotId,
    reason,
    before,
    after: await kiotSnap(kiotId),
  });
  return { ok: true, message: 'Đã khoá Kiot.' };
}

export async function unlockKiotAccount(adminId: string, kiotId: string): Promise<AdminResult> {
  const before = await kiotSnap(kiotId);
  if (!before) return { ok: false, error: 'Không tìm thấy Kiot.' };
  await unlockKiot(kiotId);
  await audit({
    adminId,
    action: 'kiot.unlock',
    targetType: 'kiot',
    targetId: kiotId,
    before,
    after: await kiotSnap(kiotId),
  });
  return { ok: true, message: 'Đã mở khoá Kiot.' };
}

export async function grantKiotYear(adminId: string, kiotId: string, reason: string): Promise<AdminResult> {
  const missing = needReason(reason);
  if (missing) return missing;
  const before = await kiotSnap(kiotId);
  if (!before) return { ok: false, error: 'Không tìm thấy Kiot.' };
  await grantYear(kiotId, adminId, reason);
  await audit({
    adminId,
    action: 'kiot.grant_year',
    targetType: 'kiot',
    targetId: kiotId,
    reason,
    before,
    after: await kiotSnap(kiotId),
  });
  return { ok: true, message: 'Đã tặng 1 năm.' };
}

export async function adjustKiotBalance(
  adminId: string,
  kiotId: string,
  amount: number,
  reason: string,
): Promise<AdminResult> {
  const before = { available: await availableBalance(kiotId) };
  const r = await adjustBalance(kiotId, adminId, amount, reason);
  if (!r.ok)
    return {
      ok: false,
      error: {
        NOT_FOUND: 'Không tìm thấy Kiot.',
        REASON_REQUIRED: 'Hãy ghi lý do.',
        INVALID_AMOUNT: 'Số tiền không hợp lệ.',
        WOULD_GO_NEGATIVE: 'Không trừ quá số dư hiện có.',
      }[r.error],
    };
  await audit({
    adminId,
    action: 'kiot.adjust_balance',
    targetType: 'kiot',
    targetId: kiotId,
    reason,
    before,
    after: { available: await availableBalance(kiotId), amount },
  });
  return { ok: true, message: 'Đã điều chỉnh số dư.' };
}

// Cài đặt (SPEC-admin.md mục 5): kiểm hợp lệ trước khi lưu, mỗi giá trị đổi ghi 1 dòng nhật ký.
const RULES: Record<SettingKey, { min?: number; max?: number; bool?: true; json?: true; label: string }> = {
  kiot_fee_vnd: { min: 2_000, max: 10_000_000, label: 'Phí thuê Kiot' },
  kiot_fee_usd_cents: { min: 1, max: 100_000, label: 'Giá Kiot (USD)' },
  platform_fee_bp: { min: 0, max: 3_000, label: 'Phí sàn' }, // basis point: 0–30%
  payout_fee_vnd: { min: 0, max: 100_000, label: 'Phí chi hộ' },
  payout_min_vnd: { min: 10_000, max: 10_000_000, label: 'Rút tối thiểu' },
  payout_auto_enabled: { bool: true, label: 'Chi tự động' },
  payout_auto_max_per_request: { min: 0, max: 1_000_000_000, label: 'Hạn mức mỗi lần' },
  payout_auto_max_per_kiot_day: { min: 0, max: 1_000_000_000, label: 'Hạn mức mỗi Kiot mỗi ngày' },
  payout_auto_daily_cap: { min: 0, max: 10_000_000_000, label: 'Hạn mức toàn sàn mỗi ngày' },
  social_free_daily_limit: { min: 1, max: 10_000, label: 'Giới hạn tim/follow mỗi ngày (Free)' },
  social_voucher_threshold: { min: 10, max: 100_000, label: 'Số tim để nhận voucher' },
  social_voucher_enabled: { bool: true, label: 'Tặng voucher mở Kiot' },
  ai_enabled: { bool: true, label: 'AI Studio' },
  ai_monthly_budget_vnd: { min: 0, max: 100_000_000, label: 'Ngân sách AI mỗi tháng' },
  ai_text_per_day: { min: 0, max: 1_000, label: 'Lượt viết chữ AI mỗi ngày' },
  ai_image_per_day: { min: 0, max: 100, label: 'Lượt vẽ ảnh AI mỗi ngày' },
  usd_vnd_rate: { min: 10_000, max: 100_000, label: 'Tỉ giá USD' },
  live_max_sessions: { min: 0, max: 20, label: 'Số buổi live cùng lúc' },
  live_max_viewers: { min: 1, max: 500, label: 'Người xem tối đa mỗi buổi' },
  live_max_minutes: { min: 5, max: 480, label: 'Thời lượng tối đa mỗi buổi (phút)' },
  xu_rules_json: { json: true, label: 'Luật thưởng xu' },
  slogans_json: { json: true, label: 'Slogan' },
  legal_info_json: { json: true, label: 'Thông tin pháp lý' },
  search_hidden_json: { json: true, label: 'Từ khoá ẩn khỏi "đang hot"' },
  badges_json: { json: true, label: 'Tên và màu huy hiệu Kiot' },
  video_long_max_seconds: { min: 61, max: 3 * 3600, label: 'Video dài tối đa (giây)' },
  video_max_mb: { min: 100, max: 4096, label: 'Dung lượng video tối đa (MB)' },
  video_long_daily_minutes: { min: 1, max: 600, label: 'Phút video dài mỗi ngày' },
  video_enable_1080: { bool: true, label: 'Mức 1080p' },
  stt_monthly_budget_vnd: { min: 0, max: 100_000_000, label: 'Ngân sách phụ đề tự động mỗi tháng' },
  points_like: { min: 0, max: 1000, label: 'Điểm khi thả tim video' },
  points_follow: { min: 0, max: 1000, label: 'Điểm khi follow' },
  points_mutual: { min: 0, max: 1000, label: 'Điểm khi follow nhau' },
  points_daily_cap: { min: 0, max: 100_000, label: 'Trần điểm mỗi ngày' },
  points_min_account_days: { min: 0, max: 365, label: 'Tuổi tài khoản tối thiểu để có điểm (ngày)' },
  points_per_xu: { min: 1, max: 1_000_000, label: 'Số điểm đổi 1 xu' },
  points_xu_month_cap: { min: 0, max: 100_000, label: 'Xu đổi từ điểm tối đa mỗi người mỗi tháng' },
  points_xu_month_budget: { min: 0, max: 100_000_000, label: 'Ngân sách xu đổi từ điểm mỗi tháng' },
};

export function validateSetting(key: SettingKey, value: string): string | null {
  const rule = RULES[key];
  if (rule.bool) return value === 'true' || value === 'false' ? null : `${rule.label}: giá trị không hợp lệ`;
  if (rule.json) {
    try {
      const v = JSON.parse(value) as unknown;
      return v && typeof v === 'object' && !Array.isArray(v) && value.length <= 20_000
        ? null
        : `${rule.label}: dữ liệu không hợp lệ`;
    } catch {
      return `${rule.label}: dữ liệu không hợp lệ`;
    }
  }
  const n = Number(value);
  if (!Number.isInteger(n)) return `${rule.label} phải là số nguyên`;
  if (n < rule.min! || n > rule.max!)
    return `${rule.label} phải từ ${rule.min!.toLocaleString('vi-VN')} đến ${rule.max!.toLocaleString('vi-VN')}`;
  return null;
}

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const keys = Object.keys(SETTING_DEFAULTS) as SettingKey[];
  const values = await Promise.all(
    keys.map((k) => (k === 'kiot_fee_vnd' ? getKiotFee().then(String) : getSetting(k))),
  );
  return Object.fromEntries(keys.map((k, i) => [k, values[i]!])) as Record<SettingKey, string>;
}

export async function updateSettings(
  adminId: string,
  changes: Partial<Record<SettingKey, string>>,
): Promise<AdminResult> {
  const entries = Object.entries(changes).filter(([k]) => k in RULES) as [SettingKey, string][];
  for (const [key, value] of entries) {
    const error = validateSetting(key, value.trim());
    if (error) return { ok: false, error };
  }
  const current = await getAllSettings();
  let changed = 0;
  for (const [key, raw] of entries) {
    const value = raw.trim();
    if (current[key] === value) continue;
    if (key === 'kiot_fee_vnd') await setKiotFee(Number(value), adminId);
    else if (key === 'kiot_fee_usd_cents') await setKiotFeeUsd(Number(value), adminId);
    else await setSetting(key, value, adminId);
    await audit({
      adminId,
      action: 'setting.update',
      targetType: 'setting',
      targetId: key,
      before: { value: current[key] },
      after: { value },
    });
    changed += 1;
  }
  return { ok: true, message: changed ? `Đã lưu ${changed} thay đổi.` : 'Không có gì thay đổi.' };
}
