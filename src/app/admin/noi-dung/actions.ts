'use server';

import { LANGS } from '@/i18n/config';
import { LEGAL_FIELDS } from '@/lib/legal';
import { invalidateCached } from '@/lib/ttl-cache';
import { publishCommitmentText, requireAdminVerified, updateSettings } from '@/modules/admin';
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

// Từ khoá không cho hiện ở "Từ khoá đang hot" (SPEC-marketplace.md V5.4 mục 3), mỗi dòng một từ.
export async function saveHiddenKeywordsAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const words = String(form.get('words') ?? '')
    .split('\n')
    .map((w) => w.trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 200);
  const r = await updateSettings(admin.id, { search_hidden_json: JSON.stringify({ words }) });
  invalidateCached('hot-keywords');
  back(
    '/admin/noi-dung',
    r.ok ? { ok: true, message: 'Đã lưu từ khoá ẩn.' } : { ok: false, message: r.error },
  );
}

// Đăng bản cam kết nội dung mới (SPEC-identity.md V5.6): 4 dòng; mọi người được hỏi lại ở lần làm việc cần cam kết.
export async function publishCommitmentAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const lines = [1, 2, 3, 4].map((i) => clean(form.get(`commit.${i}`), 200));
  const r = await publishCommitmentText(admin.id, lines);
  back(
    '/admin/noi-dung',
    r.ok ? { ok: true, message: r.message ?? 'Đã lưu.' } : { ok: false, message: r.error },
  );
}
