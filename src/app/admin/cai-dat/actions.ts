'use server';

import { forgetTrustedDevices, requireAdminVerified, updateSettings } from '@/modules/admin';
import { back } from '../flash';

const intOf = (v: FormDataEntryValue | null) => String(v ?? '').replace(/[^\d]/g, '');

export async function saveSettingsAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  // Phí sàn nhập theo %, lưu theo basis point (5% = 500).
  const percent = Number(String(form.get('platform_fee_percent') ?? '').replace(',', '.'));
  const r = await updateSettings(admin.id, {
    kiot_fee_vnd: intOf(form.get('kiot_fee_vnd')),
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
