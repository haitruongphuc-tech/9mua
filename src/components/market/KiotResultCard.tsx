import Image from 'next/image';
import type { KiotSearchCard } from '@/modules/marketplace';

// Thẻ Kiot trong kết quả tìm (SPEC-marketplace.md V5.1 mục 3): logo, tên, khoảng giá, tỉnh, khoảng cách.
export function KiotResultCard({
  kiot,
  labels,
}: {
  kiot: KiotSearchCard;
  labels: { products: string; price: string | null; distance: string | null };
}) {
  return (
    <a
      href={kiot.url}
      className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 p-3 hover:bg-white/10"
      data-testid="search-kiot"
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
        {kiot.logoUrl ? (
          <Image src={kiot.logoUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-bold">
          {kiot.name}
          {kiot.stars !== null ? (
            <span className="ml-1 text-[12px] text-amber-300">★ {kiot.stars}</span>
          ) : null}
        </span>
        <span className="text-[12px] text-white/60">
          {[kiot.province, labels.products, labels.price].filter(Boolean).join(' · ')}
        </span>
        {labels.distance ? (
          <span className="text-[12px] font-bold text-brand" data-testid="search-kiot-distance">
            📍 {labels.distance}
          </span>
        ) : null}
      </span>
    </a>
  );
}
