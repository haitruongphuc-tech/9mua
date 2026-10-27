'use server';

import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { isLang, LANG_COOKIE, langCookieOptions } from '@/i18n/config';

// Lưu ngôn ngữ đã chọn (SPEC-i18n.md mục 3). Trình duyệt gọi router.refresh() sau đó để vẽ lại trang.
export async function setLangAction(lang: string): Promise<void> {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, langCookieOptions(env().APP_URL));
}
