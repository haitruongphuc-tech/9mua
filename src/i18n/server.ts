import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { LANG_COOKIE, pickLang, type Lang } from './config';
import { DICTS, type MessageKey } from './messages';
import { getSetting } from '@/lib/settings';
import { cached } from '@/lib/ttl-cache';
import { sloganOverrides } from './overrides';
import { pickMessages, translate, type Vars } from './translate';

// Ngôn ngữ của request hiện tại: cookie `lang`, rồi ngôn ngữ trình duyệt, rồi tiếng Việt.
export const getLang = cache(async (): Promise<Lang> => {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get('accept-language'));
});

const dictFor = cache(async (lang: Lang): Promise<Record<string, string>> => {
  const json = await cached('slogans-json', 30, () => getSetting('slogans_json'));
  return { ...DICTS[lang], ...sloganOverrides(json, lang) };
});

export type T = ((key: MessageKey, vars?: Vars) => string) & { lang: Lang };

// Dùng trong Server Component / Server Action: const t = await getT(); t('common.nav.video').
export async function getT(): Promise<T> {
  const lang = await getLang();
  const dict = await dictFor(lang);
  return Object.assign((key: MessageKey, vars?: Vars) => translate(dict, DICTS.vi, key, vars), { lang });
}

// Phần chữ gửi xuống trình duyệt cho Client Component (chỉ các nhóm trang cần).
export async function messagesFor(prefixes: readonly string[]): Promise<Record<string, string>> {
  return pickMessages(await dictFor(await getLang()), prefixes);
}
