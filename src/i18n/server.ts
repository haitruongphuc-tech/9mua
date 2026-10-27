import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { LANG_COOKIE, pickLang, type Lang } from './config';
import { DICTS, type MessageKey } from './messages';
import { pickMessages, translate, type Vars } from './translate';

// Ngôn ngữ của request hiện tại: cookie `lang`, rồi ngôn ngữ trình duyệt, rồi tiếng Việt.
export const getLang = cache(async (): Promise<Lang> => {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get('accept-language'));
});

export type T = ((key: MessageKey, vars?: Vars) => string) & { lang: Lang };

// Dùng trong Server Component / Server Action: const t = await getT(); t('common.nav.video').
export async function getT(): Promise<T> {
  const lang = await getLang();
  const dict = DICTS[lang];
  return Object.assign((key: MessageKey, vars?: Vars) => translate(dict, DICTS.vi, key, vars), { lang });
}

// Phần chữ gửi xuống trình duyệt cho Client Component (chỉ các nhóm trang cần).
export async function messagesFor(prefixes: readonly string[]): Promise<Record<string, string>> {
  return pickMessages(DICTS[await getLang()], prefixes);
}
