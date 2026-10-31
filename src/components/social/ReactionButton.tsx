'use client';

import { Heart } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/client';

// Cảm xúc (SPEC-social.md V5.8): chạm là Thích như cũ; giữ lâu mở 6 cảm xúc; bấm số xem từng loại.
export const REACTION_EMOJI = {
  like: '👍',
  love: '❤️',
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😡',
} as const;
export type Reaction = keyof typeof REACTION_EMOJI;
const HOLD_MS = 450;

export function ReactionButton({
  reaction,
  total,
  onReact,
  summaryUrl,
  className,
  iconClass,
  testId,
  children,
}: {
  reaction: Reaction | null;
  total: number;
  onReact: (reaction: Reaction | null, toggle: boolean) => void; // toggle: chạm thường (thích / bỏ thích)
  summaryUrl: string; // GET → { counts: Record<Reaction, number> }
  className?: string;
  iconClass?: string;
  testId?: string;
  children?: ReactNode; // số đếm hiển thị (feed dùng định dạng gọn)
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<Reaction, number> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);
  const start = () => {
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      setOpen(true);
    }, HOLD_MS);
  };
  const end = () => clearTimeout(timer.current);
  const showCounts = async () => {
    const r = await fetch(summaryUrl)
      .then((x) => x.json() as Promise<{ counts: Record<Reaction, number> }>)
      .catch(() => null);
    if (r) setCounts(r.counts);
  };
  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (held.current) return;
          onReact(reaction ? null : 'like', true);
        }}
        aria-pressed={Boolean(reaction)}
        aria-label={t('feed.reaction.label')}
        className={className}
        data-testid={testId}
      >
        {reaction && reaction !== 'like' ? (
          <span className="text-[22px] leading-none" aria-hidden>
            {REACTION_EMOJI[reaction]}
          </span>
        ) : (
          <Heart className={iconClass ?? `h-6 w-6 ${reaction ? 'fill-current' : ''}`} aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={() => void showCounts()}
        className="text-[11px] font-bold"
        data-testid={testId ? `${testId}-count` : undefined}
      >
        {children ?? total}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-2 flex gap-1 rounded-full bg-white px-2 py-1 shadow-lg"
          data-testid="reaction-picker"
        >
          {(Object.keys(REACTION_EMOJI) as Reaction[]).map((r) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              aria-label={t(`feed.reaction.${r}`)}
              onClick={() => {
                setOpen(false);
                onReact(r, false);
              }}
              className={`grid h-10 w-10 place-items-center rounded-full text-[24px] ${reaction === r ? 'bg-zinc-200' : ''}`}
              data-testid={`reaction-${r}`}
            >
              {REACTION_EMOJI[r]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('feed.reaction.close')}
            className="px-1 text-[12px] text-black"
          >
            ✕
          </button>
        </div>
      ) : null}
      {counts ? (
        <div
          className="absolute bottom-full right-0 z-30 mb-2 w-40 rounded-[12px] bg-white p-2 text-[12px] text-black shadow-lg"
          data-testid="reaction-summary"
        >
          {(Object.keys(REACTION_EMOJI) as Reaction[])
            .filter((r) => counts[r] > 0)
            .map((r) => (
              <p key={r} className="flex justify-between">
                <span>
                  {REACTION_EMOJI[r]} {t(`feed.reaction.${r}`)}
                </span>
                <b>{counts[r]}</b>
              </p>
            ))}
          <button
            type="button"
            onClick={() => setCounts(null)}
            className="mt-1 w-full text-center text-zinc-500"
          >
            {t('feed.reaction.close')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
