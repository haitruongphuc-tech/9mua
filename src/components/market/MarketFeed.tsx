'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
      <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70" data-testid="market-empty">
        Chưa có sản phẩm phù hợp. Thử từ khoá khác hoặc bỏ bớt bộ lọc.
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
            className="rounded-full border-2 border-brand-ink px-6 py-2 font-bold"
          >
            {loading ? 'Đang tải…' : 'Xem thêm'}
          </a>
        </div>
      ) : null}
    </>
  );
}
