import type { Metadata } from 'next';
import { HashtagRow } from '@/components/market/HashtagRow';
import { MarketFeed } from '@/components/market/MarketFeed';
import { MarketFilters } from '@/components/market/MarketFilters';
import Link from 'next/link';
import { MarketShowcase } from '@/components/market/MarketShowcase';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { CATEGORIES, categoryName } from '@/modules/kiot';
import { parseSearchParams, searchProducts, toSearchString } from '@/modules/marketplace';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const p = parseSearchParams(await searchParams);
  const title = p.q ? `"${p.q}" trên Chợ` : p.category ? `${categoryName(p.category)} – Chợ` : 'Chợ 9MUA';
  return {
    title,
    description: 'Mua hàng từ hàng nghìn Kiot trên Chợ 9MUA: nông sản, đặc sản, thời trang, mỹ phẩm…',
    alternates: { canonical: p.category && !p.q ? `/cho/${p.category}` : '/cho' },
    // Trang kết quả tìm kiếm không cần lên Google, tránh trùng lặp nội dung.
    robots: p.q ? { index: false, follow: true } : undefined,
  };
}

// Chợ kiểu V4 (trang Khám phá của V4): dải cam có slogan, ô tìm dạng viên, nút danh mục, thẻ sản phẩm trắng.
export default async function MarketPage({ searchParams }: Props) {
  const params = parseSearchParams(await searchParams);
  const [page, t] = await Promise.all([searchProducts(params), getT()]);
  const query = toSearchString({ ...params, cursor: undefined });
  const category = CATEGORIES.find((c) => c.slug === params.category);
  return (
    <ClientMessages prefixes={['market.']}>
      <div className="w-full bg-gradient-to-r from-brand to-orange-400 px-4 py-5 text-center">
        <p className="font-display text-[18px] font-black md:text-[24px]">{t('common.slogan.explore')}</p>
      </div>
      <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        <h1 className="font-display text-[22px] font-black">
          {params.q
            ? t('market.resultsFor', { q: params.q })
            : category
              ? t(`market.cat.${category.slug}`)
              : t('market.title')}
        </h1>
        <Link
          href="/cho/kiot"
          className="self-start rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[13px] font-bold"
          data-testid="all-kiots"
        >
          {t('common.allKiots')} →
        </Link>
        <MarketFilters params={params} />
        {/* Chợ chưa lọc gì: hiện Hashtag nổi bật, Bán chạy, Video hot, Kiot nổi bật. */}
        {query === '' && !params.cursor ? (
          <>
            <HashtagRow />
            <MarketShowcase variant="cho" />
            <h2 className="font-display text-[18px] font-black">{t('market.allProducts')}</h2>
          </>
        ) : null}
        <MarketFeed
          key={query + (params.cursor ?? '')}
          initial={page.items}
          nextCursor={page.nextCursor}
          query={query}
        />
      </section>
    </ClientMessages>
  );
}
