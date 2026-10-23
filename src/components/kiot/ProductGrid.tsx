import Image from 'next/image';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';
import type { ProductCard } from '@/modules/kiot';

export function ProductGrid({ items, basePath }: { items: ProductCard[]; basePath: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="product-grid">
      {items.map((p) => (
        <li key={p.id} className={p.stock > 0 ? '' : 'opacity-60'}>
          <Link href={`${basePath}${p.path}`} className="flex flex-col gap-2">
            <span className="relative aspect-square overflow-hidden rounded-2xl bg-surface-muted">
              {p.thumbUrl ? (
                <Image
                  src={p.thumbUrl}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
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
            <span className="flex items-baseline gap-2">
              <span className="font-extrabold text-brand-deep">{formatVnd(p.price)}</span>
              {p.compareAtPrice ? (
                <span className="text-xs text-black/60 line-through">{formatVnd(p.compareAtPrice)}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
