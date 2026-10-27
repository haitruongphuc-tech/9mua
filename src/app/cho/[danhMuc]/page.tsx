import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketFeed } from '@/components/market/MarketFeed';
import { MarketFilters } from '@/components/market/MarketFilters';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { cached } from '@/lib/ttl-cache';
import { CATEGORIES } from '@/modules/kiot';
import { searchProducts, toSearchString, type SearchParams } from '@/modules/marketplace';

// Trang danh mục có URL đẹp (/cho/nong-san); dữ liệu cache 60 giây (SPEC-marketplace.md mục 8).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ danhMuc: string }> };

const find = (slug: string) => CATEGORIES.find((c) => c.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = find((await params).danhMuc);
  if (!c) return {};
  return {
    title: `${c.name} – Chợ`,
    description: `Mua ${c.name.toLowerCase()} từ các Kiot trên Chợ 9MUA, giao tận nơi.`,
    alternates: { canonical: `/cho/${c.slug}` },
    openGraph: { title: `${c.name} – Chợ 9MUA`, url: `/cho/${c.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const c = find((await params).danhMuc);
  if (!c) notFound();
  const search: SearchParams = { category: c.slug, sort: 'moi-nhat' };
  const [page, t] = await Promise.all([cached(`cho:${c.slug}`, 60, () => searchProducts(search)), getT()]);
  return (
    <ClientMessages prefixes={['market.']}>
      <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        <h1 className="font-display text-[22px] font-black">
          <span aria-hidden>{c.icon}</span> {t(`market.cat.${c.slug}`)}
        </h1>
        <MarketFilters params={search} />
        <MarketFeed initial={page.items} nextCursor={page.nextCursor} query={toSearchString(search)} />
      </section>
    </ClientMessages>
  );
}
