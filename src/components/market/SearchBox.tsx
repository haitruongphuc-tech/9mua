'use client';

import { Mic, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/client';

type Suggestion = { kind: string; text: string; href: string };
type Panel = { suggestions: Suggestion[]; history: string[]; hot: string[] };

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
};

// Ô tìm kiếm (SPEC-marketplace.md V5.4): gợi ý khi gõ, lịch sử 20 từ (xoá từng cái / xoá hết), từ khoá đang hot, micro
// dùng nhận dạng giọng nói của trình duyệt (tiếng Việt; tiếng nói không gửi về máy chủ 9MUA).
export function SearchBox({ q, tab, smart }: { q: string; tab: string | null; smart: boolean }) {
  const t = useT();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>({ suggestions: [], history: [], hot: [] });
  const [Speech, setSpeech] = useState<SpeechCtor | null>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setSpeech(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);

  useEffect(() => {
    if (!smart || !open) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/tim-kiem/goi-y?q=${encodeURIComponent(value.trim())}`).catch(() => null);
      const data = (await res?.json().catch(() => null)) as Partial<Panel> | null;
      setPanel({ suggestions: data?.suggestions ?? [], history: data?.history ?? [], hot: data?.hot ?? [] });
    }, 120);
    return () => clearTimeout(timer);
  }, [value, open, smart]);

  function go(text: string) {
    setValue(text);
    setOpen(false);
    requestAnimationFrame(() => form.current?.requestSubmit());
  }

  async function forget(word?: string) {
    await fetch('/api/tim-kiem/lich-su', { method: 'POST', body: JSON.stringify({ q: word ?? null }) });
    setPanel((p) => ({ ...p, history: word ? p.history.filter((h) => h !== word) : [] }));
  }

  function listen() {
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = 'vi-VN';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? '';
      if (text) go(text);
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  const chip = 'rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-bold';
  const showPanel =
    open &&
    (panel.suggestions.length > 0 || (!value.trim() && (panel.history.length > 0 || panel.hot.length > 0)));
  return (
    <div className="relative">
      <form
        ref={form}
        action="/tim-kiem"
        role="search"
        className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4"
      >
        <Search className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
        <input
          ref={input}
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          enterKeyHint="search"
          maxLength={100}
          autoFocus={!q}
          autoComplete="off"
          placeholder={t('common.search.placeholder')}
          aria-label={t('common.search.label')}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
          data-testid="search-input"
        />
        {tab ? <input type="hidden" name="tab" value={tab} /> : null}
        {smart && Speech ? (
          <button
            type="button"
            onClick={listen}
            aria-label={t('common.search.mic')}
            aria-pressed={listening}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${listening ? 'bg-brand' : 'bg-white/10'}`}
            data-testid="search-mic"
          >
            <Mic className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </form>
      {showPanel ? (
        <div
          className="absolute inset-x-0 top-12 z-30 flex flex-col gap-3 rounded-[16px] border border-white/10 bg-ink p-3 shadow-xl"
          data-testid="search-panel"
          onMouseDown={(e) => e.preventDefault()}
        >
          {value.trim() ? (
            <ul className="flex flex-col" data-testid="search-suggestions">
              {panel.suggestions.map((s) => (
                <li key={`${s.kind}:${s.text}`}>
                  <a
                    href={s.href}
                    className="flex items-center gap-2 rounded-[10px] px-2 py-2 text-[13px] hover:bg-white/10"
                  >
                    <Search className="h-3.5 w-3.5 text-white/40" aria-hidden />
                    {s.text}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <>
              {panel.history.length ? (
                <div className="flex flex-col gap-2" data-testid="search-history">
                  <div className="flex items-center justify-between text-[12px] font-bold text-white/60">
                    {t('common.search.history')}
                    <button
                      type="button"
                      onClick={() => void forget()}
                      className="text-brand"
                      data-testid="search-history-clear"
                    >
                      {t('common.search.clearAll')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panel.history.map((h) => (
                      <span key={h} className={`${chip} flex items-center gap-1`}>
                        <button type="button" onClick={() => go(h)}>
                          {h}
                        </button>
                        <button
                          type="button"
                          onClick={() => void forget(h)}
                          aria-label={t('common.search.remove', { q: h })}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {panel.hot.length ? (
                <div className="flex flex-col gap-2" data-testid="search-hot">
                  <p className="text-[12px] font-bold text-white/60">🔥 {t('common.search.hot')}</p>
                  <div className="flex flex-wrap gap-2">
                    {panel.hot.map((h) => (
                      <button key={h} type="button" onClick={() => go(h)} className={chip}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
