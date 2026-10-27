'use server';

import { LANGS } from '@/i18n/config';
import { LEGAL_FIELDS } from '@/lib/legal';
import { invalidateCached } from '@/lib/ttl-cache';
import { requireAdminVerified, updateSettings } from '@/modules/admin';
import { SLOGAN_KEYS } from './keys';
import { back } from '../flash';

const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max);

// Slogan theo từng thứ tiếng (trống = dùng câu mặc định) và thông tin pháp lý (SPEC-admin.md bổ sung 27/10).
export async function saveContentAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const slogans: Record<string, Record<string, string>> = {};
  for (const key of SLOGAN_KEYS) {
    for (const { code } of LANGS) {
      const text = clean(form.get(`slogan.${key}.${code}`), 120);
      if (text) (slogans[key] ??= {})[code] = text;
    }
  }
  const legal: Record<string, string> = {};
  for (const f of LEGAL_FIELDS) {
    const v = clean(form.get(`legal.${f}`), 200);
    if (v) legal[f] = v;
  }
  const r = await updateSettings(admin.id, {
    slogans_json: JSON.stringify(slogans),
    legal_info_json: JSON.stringify(legal),
  });
  invalidateCached('slogans-json');
  invalidateCached('legal-info');
  back(
    '/admin/noi-dung',
    r.ok ? { ok: true, message: r.message ?? 'Đã lưu.' } : { ok: false, message: r.error },
  );
}
