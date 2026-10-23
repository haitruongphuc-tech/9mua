import Image from 'next/image';
import { formatVnd } from '@/lib/format';
import type { MarketCard } from '@/modules/marketplace';

// Thẻ sản phẩm trên Chợ: bấm vào mở trang sản phẩm trên <slug>.9mua.com.
export function MarketProductCard({ p }: { p: MarketCard }) {
  return (
    <li className={p.stock > 0 ? '' : 'opacity-60'} data-testid="market-card">
      <a href={p.url} className="flex flex-col gap-1.5">
        <span className="relative aspect-square overflow-hidden rounded-2xl bg-surface-muted">
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
            <span className="absolute left-2 top-2 rounded-full bg-black/80 px-2 py-0.5 text-xs font-bold text-white">
              Hết hàng
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-sm font-bold leading-snug">{p.name}</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-extrabold text-brand-deep">{formatVnd(p.price)}</span>
          {p.compareAtPrice ? (
            <span className="text-xs text-black/50 line-through">{formatVnd(p.compareAtPrice)}</span>
          ) : null}
        </span>
        <span className="truncate text-xs text-black/60">
          {p.kiotName}
          {p.province ? ` · ${p.province}` : ''}
        </span>
        {p.sold > 0 ? (
          <span className="text-xs text-black/60">Đã bán {p.sold.toLocaleString('vi-VN')}</span>
        ) : null}
      </a>
    </li>
  );
}
