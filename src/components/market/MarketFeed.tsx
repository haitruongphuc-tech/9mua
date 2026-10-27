'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n/client';
import type { MarketCard } from '@/modules/marketplace';
import { MarketProductCard } from './MarketProductCard';

// Cuộn vô hạn: tới cuối danh sách thì tải tiếp 24 sản phẩm qua /api/cho (con trỏ, không trùng không sót).
// Không có JavaScript thì vẫn còn link "Xem thêm".
export function MarketFeed({
  initial,
  nextCursor,
  query,
}: {
  initial: MarketCard[];
  nextCursor: string | null;
  query: string;
}) {
  const t = useT();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams(query);
      qs.set('sau', cursor);
      const res = await fetch(`/api/cho?${qs.toString()}`);
      const page = (await res.json()) as { items: MarketCard[]; nextCursor: string | null };
      setItems((list) => [...list, ...page.items.filter((p) => !list.some((x) => x.id === p.id))]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (items.length === 0)
    return (
      <p
        className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-[13px] text-white/60"
        data-testid="market-empty"
      >
        {t('market.empty')}
      </p>
    );

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="market-grid">
        {items.map((p) => (
          <MarketProductCard key={p.id} p={p} />
        ))}
      </ul>
      {cursor ? (
        <div ref={sentinel} className="flex justify-center py-4">
          <a
            href={`/cho?${query ? `${query}&` : ''}sau=${cursor}`}
            onClick={(e) => {
              e.preventDefault();
              void loadMore();
            }}
            className="inline-flex h-10 items-center rounded-full border border-white/20 px-6 text-[13px] font-bold"
          >
            {loading ? t('market.loading') : t('market.more')}
          </a>
        </div>
      ) : null}
    </>
  );
}
