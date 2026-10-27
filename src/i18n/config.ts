// Đa ngôn ngữ (SPEC-i18n.md): 7 thứ tiếng như V4, tiếng Việt là gốc. Địa chỉ trang không đổi; lựa chọn lưu ở
// cookie `lang` dùng chung cho mọi <slug>.9mua.com.
export const LANGS = [
  { code: 'vi', short: 'VI', label: 'Tiếng Việt', tts: 'vi-VN', intl: 'vi-VN' },
  { code: 'en', short: 'EN', label: 'English', tts: 'en-US', intl: 'en-US' },
  { code: 'zh', short: 'ZH', label: '中文', tts: 'zh-CN', intl: 'zh-CN' },
  { code: 'ja', short: 'JA', label: '日本語', tts: 'ja-JP', intl: 'ja-JP' },
  { code: 'ko', short: 'KO', label: '한국어', tts: 'ko-KR', intl: 'ko-KR' },
  { code: 'fr', short: 'FR', label: 'Français', tts: 'fr-FR', intl: 'fr-FR' },
  { code: 'es', short: 'ES', label: 'Español', tts: 'es-ES', intl: 'es-ES' },
] as const;

export type Lang = (typeof LANGS)[number]['code'];
export const DEFAULT_LANG: Lang = 'vi';
export const LANG_COOKIE = 'lang';

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);
export const langInfo = (lang: Lang) => LANGS.find((l) => l.code === lang)!;

// Cookie đã chọn thắng; chưa chọn thì theo ngôn ngữ trình duyệt (Accept-Language, theo thứ tự ưu tiên);
// không khớp thứ tiếng nào thì tiếng Việt.
export function pickLang(cookie: string | undefined | null, acceptLanguage: string | undefined | null): Lang {
  if (isLang(cookie)) return cookie;
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { base: (tag ?? '').split('-')[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.base && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return wanted.map((w) => w.base).find(isLang) ?? DEFAULT_LANG;
}

// Không httpOnly vì không phải bí mật; domain giống cookie phiên để dùng chung cho trang Kiot.
export function langCookieOptions(appUrl: string) {
  const url = new URL(appUrl);
  return {
    httpOnly: false,
    secure: url.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 365 * 24 * 3600,
    domain: url.hostname === 'localhost' ? 'localhost' : `.${url.hostname}`,
  };
}
