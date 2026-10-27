'use client';

import Image from 'next/image';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { MarketCard } from '@/modules/marketplace';

// Thẻ sản phẩm trắng kiểu V4 trên Chợ: bấm vào mở trang sản phẩm trên <slug>.9mua.com.
export function MarketProductCard({ p }: { p: MarketCard }) {
  const t = useT();
  return (
    <li
      className={`overflow-hidden rounded-[14px] bg-white text-black ${p.stock > 0 ? '' : 'opacity-60'}`}
      data-testid="market-card"
    >
      <a href={p.url} className="flex h-full flex-col">
        <span className="relative aspect-square bg-zinc-100">
          {p.thumbUrl ? (
            <Image
              src={p.thumbUrl}
              alt={p.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              unoptimized
            />
          ) : null}
          {p.stock <= 0 ? (
            <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">
              {t('market.soldOut')}
            </span>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col gap-1 p-2.5">
          <span className="line-clamp-2 text-[13px] font-bold leading-tight">{p.name}</span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[14px] font-black text-brand">{formatVnd(p.price)}</span>
            {p.compareAtPrice ? (
              <span className="text-[10px] text-zinc-500 line-through">{formatVnd(p.compareAtPrice)}</span>
            ) : null}
          </span>
          <span className="truncate text-[11px] text-zinc-500">
            {p.kiotName}
            {p.province ? ` · ${p.province}` : ''}
          </span>
          {p.sold > 0 ? (
            <span className="text-[11px] text-zinc-500">{t('market.sold', { count: p.sold })}</span>
          ) : null}
        </span>
      </a>
    </li>
  );
}
