import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import type { ProductCard } from '@/modules/kiot';
import { AddToCartPill } from './AddToCartPill';

// Tab "Sản phẩm" của trang Kiot V4: thẻ trắng bo 14px, giá cam, nút "+ Giỏ" đen.
export async function KiotProductGrid({ items, basePath }: { items: ProductCard[]; basePath: string }) {
  const t = await getT();
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="product-grid">
      {items.map((p) => (
        <li
          key={p.id}
          className={`overflow-hidden rounded-[14px] bg-white text-black ${p.stock > 0 ? '' : 'opacity-60'}`}
        >
          <Link href={`${basePath}${p.path}`} className="relative block aspect-square bg-zinc-100">
            {p.thumbUrl ? (
              <Image
                src={p.thumbUrl}
                alt={p.name}
                fill
                sizes="(max-width: 768px) 50vw, 300px"
                className="object-cover"
                unoptimized
              />
            ) : null}
            {p.stock <= 0 ? (
              <span className="absolute left-2 top-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                {t('profile.outOfStock')}
              </span>
            ) : null}
          </Link>
          <div className="p-2.5">
            <Link href={`${basePath}${p.path}`} className="line-clamp-2 text-[13px] font-bold leading-tight">
              {p.name}
            </Link>
            <div className="mt-1.5 flex items-center justify-between gap-1">
              <span className="flex min-w-0 flex-col">
                <span className="text-[14px] font-black text-brand">{formatVnd(p.price)}</span>
                {p.compareAtPrice ? (
                  <span className="text-[10px] text-zinc-500 line-through">
                    {formatVnd(p.compareAtPrice)}
                  </span>
                ) : null}
              </span>
              {p.stock > 0 ? <AddToCartPill productId={p.id} name={p.name} /> : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
