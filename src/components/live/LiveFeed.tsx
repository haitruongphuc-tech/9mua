'use client';

import { useEffect, useRef, useState } from 'react';
import type { LiveView } from '@/modules/live';
import { LivePlayer } from './LivePlayer';

type LiveData = Extract<LiveView, { kind: 'live' }>;

// Vuốt dọc giữa các buổi đang live (SPEC-live.md mục 4). Buổi chiếm ≥ 60% khung là buổi đang xem.
export function LiveFeed({ lives, loggedIn }: { lives: LiveData[]; loggedIn: boolean }) {
  const [active, setActive] = useState(lives[0]?.id ?? null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting && e.intersectionRatio >= 0.6)
            setActive((e.target as HTMLElement).dataset.id ?? null);
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll('[data-id]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lives]);
  return (
    <div
      ref={box}
      className="no-scrollbar h-[calc(100dvh-210px)] min-h-[480px] snap-y snap-mandatory overflow-y-auto rounded-[20px] border border-white/10 md:h-[600px]"
      data-testid="live-feed"
    >
      {lives.map((l) => (
        <section key={l.id} data-id={l.id} className="h-full snap-start">
          <LivePlayer view={l} active={active === l.id} loggedIn={loggedIn} />
        </section>
      ))}
    </div>
  );
}
