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

// Tên và màu huy hiệu Kiot (SPEC-kiot.md V5.2 mục 4).
export async function saveBadgesAction(form: FormData): Promise<void> {
  const admin = await requireAdminVerified();
  const color = (v: FormDataEntryValue | null, d: string) =>
    /^#[0-9a-f]{6}$/i.test(String(v ?? '')) ? String(v) : d;
  const value = {
    names: {
      origin: clean(form.get('name.origin'), 40) || 'Đã xác thực nguồn gốc',
      bank: clean(form.get('name.bank'), 40) || 'Đã xác thực ngân hàng',
      video: clean(form.get('name.video'), 40) || 'Đã xác thực video',
    },
    colors: [
      color(form.get('color.1'), '#16a34a'),
      color(form.get('color.2'), '#eab308'),
      color(form.get('color.3'), '#9333ea'),
    ],
  };
  const r = await updateSettings(admin.id, { badges_json: JSON.stringify(value) });
  back('/admin/noi-dung', r.ok ? { ok: true, message: 'Đã lưu huy hiệu.' } : { ok: false, message: r.error });
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
