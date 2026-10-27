'use client';

import { Globe, Volume2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { setLangAction } from '@/app/actions/lang';
import { LANGS, langInfo } from '@/i18n/config';
import { useLang, useT } from '@/i18n/client';
import { sloganKey } from '@/lib/slogans';

// Nút ngôn ngữ trên header (V4): danh sách 7 thứ tiếng + đọc to slogan của trang (SPEC-i18n.md mục 1, 8).
export function LanguageMenu({ onKiotHost }: { onKiotHost: boolean }) {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const choose = (code: string) => {
    setOpen(false);
    startTransition(async () => {
      await setLangAction(code);
      router.refresh();
    });
  };

  const speak = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(t(`common.slogan.${sloganKey(pathname, { onKiotHost })}`));
    u.lang = langInfo(lang).tts;
    u.onend = u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('common.lang.label')}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={pending}
        className="flex h-10 items-center gap-1 rounded-full bg-white/10 px-3 text-[12px] font-bold disabled:opacity-60"
        data-testid="lang-button"
      >
        <Globe className="h-4 w-4" aria-hidden />
        {langInfo(lang).short}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-[200px] rounded-[16px] bg-white p-2 text-black shadow-2xl"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === lang}
              lang={l.code}
              onClick={() => choose(l.code)}
              className={`w-full rounded-[10px] px-3 py-2 text-left text-[13px] ${
                l.code === lang ? 'bg-brand font-bold text-white' : 'hover:bg-brand-cream'
              }`}
            >
              {l.label}
            </button>
          ))}
          {canSpeak ? (
            <button
              type="button"
              onClick={speak}
              className="mt-1 flex h-9 w-full items-center justify-center gap-1 rounded-[10px] bg-black text-[12px] font-bold text-white"
            >
              <Volume2 className="h-4 w-4" aria-hidden />{' '}
              {speaking ? t('common.lang.stop') : t('common.lang.read')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
