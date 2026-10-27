import { MapPin } from 'lucide-react';
import Image from 'next/image';
import { getT } from '@/i18n/server';
import { CATEGORIES } from '@/modules/kiot';
import type { KiotCard } from '@/modules/marketplace';

// Thẻ Kiot kiểu V4 (danh bạ Kiot, Kiot nổi bật): nền trắng 5%, viền trắng mờ, rê chuột thì viền cam.
export async function KiotCardList({
  items,
  showOrders = true,
}: {
  items: KiotCard[];
  showOrders?: boolean;
}) {
  const t = await getT();
  // Module trả tên ngành hàng tiếng Việt: đổi sang tên theo ngôn ngữ đang chọn.
  const categoryLabel = (name: string | null) => {
    const c = CATEGORIES.find((x) => x.name === name);
    return c ? t(`market.cat.${c.slug}`) : name;
  };
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="kiot-cards">
      {items.map((k) => (
        <li key={k.slug}>
          <a
            href={k.url}
            className="flex h-full flex-col items-center gap-2 rounded-[16px] border border-white/10 bg-white/5 p-3 text-center transition hover:border-brand/60"
          >
            <span className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-brand bg-gradient-to-br from-brand to-[#c2410c] text-xl font-black">
              {k.logoUrl ? (
                <Image src={k.logoUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
              ) : (
                <span aria-hidden>{k.name.trim().charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="line-clamp-2 text-[13px] font-bold">{k.name}</span>
            <span className="flex items-center gap-1 text-[11px] text-white/50">
              {k.province ? <MapPin className="h-3 w-3" aria-hidden /> : null}
              {[k.province, categoryLabel(k.mainCategory)].filter(Boolean).join(' · ') ||
                t('market.kiotProducts', { count: k.products })}
            </span>
            {showOrders && k.completedOrders > 0 ? (
              <span className="text-[11px] text-white/50">
                {t('market.kiotOrders', { count: k.completedOrders.toLocaleString(t.lang) })}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
