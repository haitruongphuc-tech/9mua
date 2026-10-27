'use server';

import { forgetTrustedDevices, requireAdminVerified, updateSettings } from '@/modules/admin';
import { updateKiotFeeFromRate } from '@/modules/billing';
import { formatVnd } from '@/lib/format';
import { back } from '../flash';

const intOf = (v: FormDataEntryValue | null) => String(v ?? '').replace(/[^\d]/g, '');

export async function saveSettingsAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  // Phí sàn nhập theo %, lưu theo basis point (5% = 500).
  const percent = Number(String(form.get('platform_fee_percent') ?? '').replace(',', '.'));
  // Giá Kiot nhập bằng USD ("1,00"), lưu theo cent; VNĐ tự tính theo tỷ giá (SPEC-billing.md bổ sung 27/10).
  const usd = Number(String(form.get('kiot_fee_usd') ?? '').replace(',', '.'));
  const r = await updateSettings(admin.id, {
    kiot_fee_usd_cents: Number.isFinite(usd) ? String(Math.round(usd * 100)) : 'x',
    platform_fee_bp: Number.isFinite(percent) ? String(Math.round(percent * 100)) : 'x',
    payout_fee_vnd: intOf(form.get('payout_fee_vnd')),
    payout_min_vnd: intOf(form.get('payout_min_vnd')),
    payout_auto_max_per_request: intOf(form.get('payout_auto_max_per_request')),
    payout_auto_max_per_kiot_day: intOf(form.get('payout_auto_max_per_kiot_day')),
    payout_auto_daily_cap: intOf(form.get('payout_auto_daily_cap')),
    social_free_daily_limit: intOf(form.get('social_free_daily_limit')),
    social_voucher_threshold: intOf(form.get('social_voucher_threshold')),
    social_voucher_enabled: form.get('social_voucher_enabled') === 'on' ? 'true' : 'false',
  });
  back(
    '/admin/cai-dat',
    r.ok ? { ok: true, message: r.message ?? 'Đã lưu.' } : { ok: false, message: r.error },
  );
}

// Công tắc chi tự động: 1 chạm (kèm xác nhận) khi có sự cố.
export async function toggleAutoPayoutAction(enable: boolean): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await updateSettings(admin.id, { payout_auto_enabled: enable ? 'true' : 'false' });
  back(
    '/admin/cai-dat',
    r.ok
      ? { ok: true, message: enable ? 'Đã BẬT chi tự động.' : 'Đã TẮT chi tự động.' }
      : { ok: false, message: r.error },
  );
}

// Bắt mọi thiết bị đã nhớ 30 ngày phải nhập mã 2 lớp lại (SPEC-admin.md bổ sung 27/10).
export async function forgetDevicesAction(): Promise<void> {
  const admin = await requireAdminVerified();
  const n = await forgetTrustedDevices(admin.id);
  back('/admin/cai-dat', { ok: true, message: `Đã quên ${n} thiết bị. Lần sau phải nhập mã 2 lớp.` });
}

// Lấy tỷ giá Vietcombank ngay (thường cron làm lúc 7:00 mỗi sáng).
export async function updateRateAction(): Promise<void> {
  await requireAdminVerified();
  const r = await updateKiotFeeFromRate();
  back(
    '/admin/cai-dat',
    !r.ok
      ? { ok: false, message: `Không lấy được tỷ giá Vietcombank (${r.reason}). Giá Kiot giữ nguyên.` }
      : r.applied
        ? { ok: true, message: `Tỷ giá ${formatVnd(r.rate)}/USD → giá Kiot ${formatVnd(r.feeVnd)}/năm.` }
        : {
            ok: false,
            message: `Tỷ giá ${formatVnd(r.rate)}/USD làm giá lệch hơn 10% nên chưa áp dụng. Lưu lại giá USD để áp dụng.`,
          },
  );
}
