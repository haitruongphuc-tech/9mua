import type { Lang } from './config';

// Slogan CEO sửa ở /admin/noi-dung thay câu mặc định của từ điển (theo từng thứ tiếng; trống thì giữ mặc định).
export function sloganOverrides(json: string, lang: Lang): Record<string, string> {
  try {
    const all = JSON.parse(json) as Record<string, Record<string, unknown>>;
    const out: Record<string, string> = {};
    for (const [key, byLang] of Object.entries(all)) {
      const text = byLang?.[lang];
      if (typeof text === 'string' && text.trim()) out[`common.slogan.${key}`] = text.trim();
    }
    return out;
  } catch {
    return {};
  }
}
