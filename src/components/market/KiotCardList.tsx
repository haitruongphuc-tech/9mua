import Image from 'next/image';
import type { KiotCard } from '@/modules/marketplace';

export function KiotCardList({ items, showOrders = true }: { items: KiotCard[]; showOrders?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="kiot-cards">
      {items.map((k) => (
        <li key={k.slug}>
          <a
            href={k.url}
            className="flex h-full flex-col items-center gap-2 rounded-2xl border-2 border-black/10 p-3 text-center hover:border-brand-ink"
          >
            <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-2 border-brand-ink bg-brand text-xl font-extrabold text-brand-ink">
              {k.logoUrl ? (
                <Image src={k.logoUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
              ) : (
                <span aria-hidden>{k.name.trim().charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="line-clamp-2 text-sm font-bold">{k.name}</span>
            <span className="text-xs text-black/60">
              {[k.province, k.mainCategory].filter(Boolean).join(' · ') || `${k.products} sản phẩm`}
            </span>
            {showOrders && k.completedOrders > 0 ? (
              <span className="text-xs text-black/60">
                {k.completedOrders.toLocaleString('vi-VN')} đơn thành công
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
