import type { Metadata } from 'next';
import { MarketFeed } from '@/components/market/MarketFeed';
import { MarketFilters } from '@/components/market/MarketFilters';
import { MarketShowcase } from '@/components/market/MarketShowcase';
import { categoryName } from '@/modules/kiot';
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

export default async function MarketPage({ searchParams }: Props) {
  const params = parseSearchParams(await searchParams);
  const page = await searchProducts(params);
  const query = toSearchString({ ...params, cursor: undefined });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-extrabold">
        {params.q
          ? `Kết quả cho "${params.q}"`
          : params.category
            ? categoryName(params.category)
            : 'Chợ 9MUA'}
      </h1>
      <MarketFilters params={params} />
      {/* Chợ chưa lọc gì: hiện Bán chạy, Video hot, Kiot nổi bật (trước T40 nằm ở trang chủ). */}
      {query === '' && !params.cursor ? (
        <>
          <MarketShowcase variant="cho" />
          <h2 className="text-xl font-extrabold">Tất cả sản phẩm</h2>
        </>
      ) : null}
      <MarketFeed
        key={query + (params.cursor ?? '')}
        initial={page.items}
        nextCursor={page.nextCursor}
        query={query}
      />
    </section>
  );
}
