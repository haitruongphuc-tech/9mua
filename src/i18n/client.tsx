'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { DEFAULT_LANG, type Lang } from './config';
import type { MessageKey } from './messages/vi';
import { translate, type Vars } from './translate';

type Ctx = { lang: Lang; messages: Record<string, string> };
const I18nContext = createContext<Ctx>({ lang: DEFAULT_LANG, messages: {} });

// Lồng được: provider con thêm nhóm chữ của trang vào nhóm "common." của layout.
export function I18nProvider({
  lang,
  messages,
  children,
}: {
  lang: Lang;
  messages: Record<string, string>;
  children: React.ReactNode;
}) {
  const parent = useContext(I18nContext);
  const value = useMemo(
    () => ({ lang, messages: { ...parent.messages, ...messages } }),
    [lang, parent, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { messages } = useContext(I18nContext);
  return useCallback((key: MessageKey, vars?: Vars) => translate(messages, messages, key, vars), [messages]);
}

export const useLang = () => useContext(I18nContext).lang;
