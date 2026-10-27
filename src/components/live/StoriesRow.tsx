'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n/client';
import type { StoryGroup } from '@/modules/creator';

const SEEN_KEY = 'nm_story_seen';

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

// Hàng Story 24 giờ ở đầu trang Live (V4): vòng cam = có Story chưa xem, xám = đã xem (nhớ trên máy người xem).
// Bấm vào xem toàn màn hình, thanh tiến độ theo từng Story, hết thì tự sang người tiếp theo.
export function StoriesRow({ groups }: { groups: StoryGroup[] }) {
  const t = useT();
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<{ g: number; i: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => setSeen(readSeen()), []);

  const current = open ? groups[open.g]?.items[open.i] : null;
  useEffect(() => {
    if (!current) return;
    setSeen((s) => {
      const next = new Set(s).add(current.id);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-500)));
      } catch {}
      return next;
    });
  }, [current]);

  function step(delta: 1 | -1) {
    if (!open) return;
    const g = groups[open.g]!;
    const i = open.i + delta;
    if (i >= 0 && i < g.items.length) return setOpen({ g: open.g, i });
    const ng = open.g + delta;
    if (ng < 0 || ng >= groups.length) return setOpen(null);
    setOpen({ g: ng, i: delta > 0 ? 0 : groups[ng]!.items.length - 1 });
  }

  return (
    <section
      aria-label={t('live.stories')}
      className="no-scrollbar flex gap-3 overflow-x-auto px-4 py-3"
      data-testid="stories"
    >
      <Link href="/video/dang?story=1" className="flex w-16 shrink-0 flex-col items-center gap-1">
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed border-white/40 text-[22px] font-black">
          +
        </span>
        <span className="w-full truncate text-center text-[11px] font-bold">{t('live.addStory')}</span>
      </Link>
      {groups.map((g, gi) => {
        const unseen = g.items.some((s) => !seen.has(s.id));
        return (
          <button
            key={g.author.id}
            type="button"
            onClick={() =>
              setOpen({
                g: gi,
                i: Math.max(
                  0,
                  g.items.findIndex((s) => !seen.has(s.id)),
                ),
              })
            }
            className="flex w-16 shrink-0 flex-col items-center gap-1"
            aria-label={t('live.storyBy', { name: g.author.displayName })}
            data-testid="story-ring"
          >
            <span
              className={`grid h-16 w-16 place-items-center rounded-full p-[3px] ${
                unseen ? 'bg-gradient-to-tr from-brand via-orange-400 to-yellow-300' : 'bg-white/20'
              }`}
            >
              <span className="grid h-full w-full place-items-center rounded-full border-2 border-ink bg-gradient-to-br from-brand to-red-500 text-[20px] font-black">
                {g.author.displayName.trim().charAt(0).toUpperCase() || '9'}
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-bold">{g.author.displayName}</span>
          </button>
        );
      })}
      {open && current && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[85] bg-black text-white"
              role="dialog"
              aria-modal="true"
              data-testid="story-viewer"
            >
              <div className="absolute inset-x-2 top-2 z-10 flex gap-1">
                {groups[open.g]!.items.map((s, i) => (
                  <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                    <span
                      ref={i === open.i ? bar : undefined}
                      className="block h-full bg-white"
                      style={{ width: i < open.i ? '100%' : '0%' }}
                    />
                  </span>
                ))}
              </div>
              <div className="absolute inset-x-3 top-6 z-10 flex items-center justify-between">
                <span className="text-[13px] font-black">@{groups[open.g]!.author.displayName}</span>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  aria-label={t('live.closeStory')}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/40"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <video
                key={current.id}
                ref={video}
                src={current.fileUrl}
                poster={current.posterUrl ?? undefined}
                autoPlay
                playsInline
                muted
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (bar.current && el.duration)
                    bar.current.style.width = `${(el.currentTime / el.duration) * 100}%`;
                }}
                onEnded={() => step(1)}
                className="h-full w-full object-contain"
              />
              {current.caption ? (
                <p className="absolute inset-x-4 bottom-8 z-10 text-[14px] font-bold drop-shadow">
                  {current.caption}
                </p>
              ) : null}
              {/* Chạm nửa trái: Story trước; nửa phải: Story sau. */}
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => step(-1)}
                className="absolute inset-y-16 left-0 w-1/3"
              />
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => step(1)}
                className="absolute inset-y-16 right-0 w-2/3"
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
