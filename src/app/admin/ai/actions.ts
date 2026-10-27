'use server';

import { requireAdminVerified, updateSettings } from '@/modules/admin';
import { aiSelfTest } from '@/modules/ai';
import { back } from '../flash';

const intOf = (v: FormDataEntryValue | null) => String(v ?? '').replace(/[^\d]/g, '');

export async function saveAiSettingsAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await updateSettings(admin.id, {
    ai_enabled: form.get('ai_enabled') === 'on' ? 'true' : 'false',
    ai_monthly_budget_vnd: intOf(form.get('ai_monthly_budget_vnd')),
    ai_text_per_day: intOf(form.get('ai_text_per_day')),
    ai_image_per_day: intOf(form.get('ai_image_per_day')),
    usd_vnd_rate: intOf(form.get('usd_vnd_rate')),
  });
  back('/admin/ai', r.ok ? { ok: true, message: r.message ?? 'Đã lưu.' } : { ok: false, message: r.error });
}

// Gọi AI thật 1 lần với dữ liệu mẫu để kiểm tra khoá và model (có tốn một ít tiền, ghi vào sổ chi phí).
export async function selfTestAction(kind: 'text' | 'image'): Promise<void> {
  const admin = await requireAdminVerified();
  const r = await aiSelfTest(admin.id, kind);
  back('/admin/ai', { ok: r.ok, message: `${r.ok ? 'Kết nối được' : 'Lỗi'} — ${r.detail}` });
}
