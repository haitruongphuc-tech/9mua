'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/client';
import type { SoundItem } from '@/app/api/sounds/route';

// Chọn nhạc nền khi đăng (SPEC-creator.md V5.6 mục 2): âm thanh thịnh hành 7 ngày hoặc tìm theo tên, nghe thử, chọn giây
// bắt đầu, âm lượng nhạc và tiếng gốc 0–100%. Máy chủ trộn tiếng khi xử lý.
export type PickedSound = { sound: SoundItem; startSec: number; volume: number; originalVolume: number };

export function soundName(
  s: Pick<SoundItem, 'title' | 'artist' | 'authorName'>,
  original: (name: string) => string,
) {
  if (!s.title) return original(s.authorName ?? '');
  return s.artist ? `${s.title} – ${s.artist}` : s.title;
}

export function SoundPicker({
  value,
  onChange,
}: {
  value: PickedSound | null;
  onChange: (value: PickedSound | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SoundItem[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const name = (s: SoundItem) => soundName(s, (n) => t('post.sound.original', { name: n }));

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/sounds?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { items: SoundItem[] }) => setItems(d.items))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  // Một thẻ audio dùng chung: nghe thử trong danh sách, hoặc nghe từ giây đã chọn.
  const play = (s: SoundItem, from = 0) => {
    const a = audio.current;
    if (!a) return;
    if (playing === s.id) {
      a.pause();
      return setPlaying(null);
    }
    a.src = s.url;
    a.currentTime = from;
    a.volume = value?.sound.id === s.id ? value.volume / 100 : 1;
    void a.play().catch(() => setPlaying(null));
    setPlaying(s.id);
  };
  useEffect(() => {
    const a = audio.current;
    return () => a?.pause();
  }, []);

  const chip = 'h-9 shrink-0 rounded-full px-3 text-[12px] font-black';
  return (
    <fieldset
      className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-white/5 p-3"
      data-testid="sound-picker"
    >
      <legend className="px-1 text-[12px] font-bold text-white/70">♫ {t('post.sound.title')}</legend>
      <audio ref={audio} onEnded={() => setPlaying(null)} className="hidden" />
      {value ? (
        <div className="flex flex-col gap-2" data-testid="sound-picked">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => play(value.sound, value.startSec)}
              className={`${chip} bg-white/10`}
              aria-label={t('post.sound.preview')}
            >
              {playing === value.sound.id ? '❚❚' : '▶'}
            </button>
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{name(value.sound)}</span>
            <button
              type="button"
              onClick={() => {
                audio.current?.pause();
                setPlaying(null);
                onChange(null);
              }}
              className={`${chip} border border-white/15`}
              data-testid="sound-remove"
            >
              {t('post.sound.remove')}
            </button>
          </div>
          {value.sound.durationSec > 1 ? (
            <label className="flex items-center gap-2 text-[12px] font-bold text-white/70">
              <span className="w-32 shrink-0">
                {t('post.sound.start', { sec: value.startSec.toFixed(1) })}
              </span>
              <input
                type="range"
                min={0}
                max={Math.floor((value.sound.durationSec - 1) * 2) / 2}
                step={0.5}
                value={value.startSec}
                onChange={(e) => onChange({ ...value, startSec: Number(e.target.value) })}
                className="min-w-0 flex-1 accent-[#ff6b00]"
                data-testid="sound-start"
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-[12px] font-bold text-white/70">
            <span className="w-32 shrink-0">{t('post.sound.volume', { pct: value.volume })}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={value.volume}
              onChange={(e) => {
                onChange({ ...value, volume: Number(e.target.value) });
                if (audio.current) audio.current.volume = Number(e.target.value) / 100;
              }}
              className="min-w-0 flex-1 accent-[#ff6b00]"
              data-testid="sound-volume"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] font-bold text-white/70">
            <span className="w-32 shrink-0">
              {t('post.sound.originalVolume', { pct: value.originalVolume })}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={value.originalVolume}
              onChange={(e) => onChange({ ...value, originalVolume: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-[#ff6b00]"
              data-testid="sound-original-volume"
            />
          </label>
          <p className="text-[11px] text-white/50">{t('post.sound.hint')}</p>
        </div>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-white/15 text-[13px] font-black"
          data-testid="sound-open"
        >
          ♫ {t('post.sound.add')}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('post.sound.search')}
            className="h-10 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] text-white outline-none focus:border-brand"
            data-testid="sound-search"
          />
          {!query ? <p className="text-[12px] font-bold text-white/70">{t('post.sound.trending')}</p> : null}
          {items && items.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-white/50">{t('post.sound.empty')}</p>
          ) : null}
          <ul
            className="flex max-h-72 flex-col divide-y divide-white/10 overflow-y-auto"
            data-testid="sound-results"
          >
            {(items ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <button
                  type="button"
                  onClick={() => play(s)}
                  className={`${chip} w-9 bg-white/10 px-0`}
                  aria-label={t('post.sound.preview')}
                >
                  {playing === s.id ? '❚❚' : '▶'}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{name(s)}</span>
                  <span className="text-[11px] text-white/50">
                    {t('post.sound.uses', { count: s.uses })} · {Math.round(s.durationSec)}s
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    audio.current?.pause();
                    setPlaying(null);
                    setOpen(false);
                    onChange({ sound: s, startSec: 0, volume: 80, originalVolume: 100 });
                  }}
                  className={`${chip} bg-brand text-white`}
                  data-testid="sound-choose"
                >
                  {t('post.sound.choose')}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[12px] font-bold text-white/60"
          >
            {t('post.sound.close')}
          </button>
        </div>
      )}
    </fieldset>
  );
}
