import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketProductCard } from '@/components/market/MarketProductCard';
import { Avatar } from '@/components/ui/Avatar';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { searchVideos } from '@/modules/creator';
import { searchPublicUsers } from '@/modules/identity';
import { logSearch, searchKiots, searchProducts } from '@/modules/marketplace';
import { SearchBox } from '@/components/market/SearchBox';
import { readAnonId } from '@/lib/anon-id';
import { getCurrentUser } from '@/modules/identity';
import { KiotResultCard } from '@/components/market/KiotResultCard';
import { NearMe } from '@/components/market/NearMe';
import { isFeatureOn } from '@/lib/features';
import { formatVnd } from '@/lib/format';
import { searchHashtags, trendingHashtags } from '@/modules/social';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('common.search.title'), robots: { index: false } };
}

const TABS = ['tat-ca', 'tai-khoan', 'video', 'hashtag', 'san-pham', 'kiot'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL = {
  'tat-ca': 'common.search.tab.all',
  'tai-khoan': 'common.search.tab.users',
  video: 'common.search.tab.videos',
  hashtag: 'common.search.tab.hashtags',
  'san-pham': 'common.search.tab.products',
  kiot: 'common.search.tab.kiots',
} as const;
// Tab "Tất cả": 3 tài khoản, 6 video, 5 hashtag, 6 sản phẩm; tab riêng: 30 kết quả (SPEC-social.md bổ sung 30/10, A3).
const ALL = { users: 3, videos: 6, hashtags: 5, products: 6, kiots: 3 };
const FULL = 30;

// Tìm kiếm chung: tài khoản, video, hashtag, sản phẩm. Tìm không dấu, không phân biệt hoa thường.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; sao?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const tab: Tab = TABS.find((x) => x === params.tab) ?? 'tat-ca';
  const all = tab === 'tat-ca';
  const want = (t: Tab, n: number) => (q && (all || tab === t) ? n : 0);
  // Tab Kiot + Gần tôi (SPEC-marketplace.md V5.1–V5.2), công tắc search_more.
  const searchMore = await isFeatureOn('search_more');
  const tabs = TABS.filter((x) => x !== 'kiot' || searchMore);
  const [t, users, videos, hashtags, products, trending, kiots] = await Promise.all([
    getT(),
    want('tai-khoan', 1) ? searchPublicUsers(q, all ? ALL.users : FULL) : Promise.resolve([]),
    want('video', 1) ? searchVideos(q, all ? ALL.videos : FULL) : Promise.resolve([]),
    want('hashtag', 1) ? searchHashtags(q, all ? ALL.hashtags : FULL) : Promise.resolve([]),
    want('san-pham', 1)
      ? searchProducts({ q, sort: 'phu-hop' }, all ? ALL.products : FULL).then((p) => p.items)
      : Promise.resolve([]),
    q ? Promise.resolve([]) : trendingHashtags(10),
    searchMore && want('kiot', 1)
      ? searchKiots({ q, limit: all ? ALL.kiots : FULL, minStars: params.sao === '4' ? 4 : undefined }).then(
          (p) => p.items,
        )
      : Promise.resolve([]),
  ]);
  const href = (to: Tab) => `/tim-kiem?q=${encodeURIComponent(q)}${to === 'tat-ca' ? '' : `&tab=${to}`}`;
  // Ghi lịch sử tìm (SPEC-marketplace.md V5.4 mục 5): không có vị trí; Gần tôi đi đường POST riêng, không ghi.
  if (q && searchMore) {
    const user = await getCurrentUser();
    await logSearch({
      userId: user?.id,
      anonId: await readAnonId(),
      q,
      tab,
      results: users.length + videos.length + hashtags.length + products.length + kiots.length,
    }).catch(() => {});
  }
  const nothing =
    q && !users.length && !videos.length && !hashtags.length && !products.length && !kiots.length;

  const heading = (to: Tab, show: boolean) => (
    <div className="flex items-baseline justify-between">
      <h2 className="font-display text-[16px] font-black">{t(TAB_LABEL[to])}</h2>
      {all && show ? (
        <Link href={href(to)} className="text-[13px] font-bold text-brand">
          {t('common.search.more')}
        </Link>
      ) : null}
    </div>
  );

  return (
    <ClientMessages prefixes={['market.']}>
      <section className="mx-auto flex w-full max-w-[900px] flex-col gap-5 px-4 py-5">
        <SearchBox q={q} tab={tab === 'tat-ca' ? null : tab} smart={searchMore} />

        {q ? (
          <nav
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
            aria-label={t('common.search.title')}
          >
            {tabs.map((x) => (
              <Link
                key={x}
                href={href(x)}
                aria-current={tab === x ? 'page' : undefined}
                className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-bold leading-9 ${
                  tab === x ? 'bg-white text-ink' : 'bg-white/10 text-white/80'
                }`}
              >
                {t(TAB_LABEL[x])}
              </Link>
            ))}
          </nav>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[16px] font-black">{t('common.search.trending')}</h2>
            <div className="flex flex-wrap gap-2">
              {trending.map((h) => (
                <Link
                  key={h.tag}
                  href={`/hashtag/${h.tag}`}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-bold"
                >
                  #{h.tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {nothing ? (
          <p className="py-10 text-center text-[14px] text-white/60" data-testid="search-empty">
            {t('common.search.empty', { q })}
          </p>
        ) : null}

        {users.length ? (
          <div className="flex flex-col gap-2">
            {heading('tai-khoan', users.length >= ALL.users)}
            <ul className="flex flex-col divide-y divide-white/10">
              {users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/creator/${u.id}`}
                    className="flex items-center gap-3 py-2.5"
                    data-testid="search-user"
                  >
                    <Avatar name={u.displayName} url={u.avatarUrl} className="h-11 w-11 text-[16px]" />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{u.displayName}</span>
                      {u.handle ? (
                        <span className="block truncate text-[12px] text-white/60">@{u.handle}</span>
                      ) : null}
                      <span className="text-[12px] text-white/50">
                        {t('common.search.followers', { count: u.followers.toLocaleString(t.lang) })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {videos.length ? (
          <div className="flex flex-col gap-2" data-testid="search-videos">
            {heading('video', videos.length >= ALL.videos)}
            <VideoGrid videos={videos} showAuthor />
          </div>
        ) : null}

        {hashtags.length ? (
          <div className="flex flex-col gap-2">
            {heading('hashtag', hashtags.length >= ALL.hashtags)}
            <ul className="flex flex-col divide-y divide-white/10">
              {hashtags.map((h) => (
                <li key={h.tag}>
                  <Link
                    href={`/hashtag/${h.tag}`}
                    className="flex items-center justify-between py-2.5"
                    data-testid="search-hashtag"
                  >
                    <span className="font-bold">#{h.tag}</span>
                    <span className="text-[12px] text-white/50">
                      {t('common.search.videos', { count: h.videos })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {products.length ? (
          <div className="flex flex-col gap-2">
            {heading('san-pham', products.length >= ALL.products)}
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <MarketProductCard key={p.id} p={p} />
              ))}
            </ul>
          </div>
        ) : null}

        {searchMore && q && (tab === 'kiot' || tab === 'san-pham') ? (
          <NearMe tab={tab === 'kiot' ? 'kiot' : 'san-pham'} q={q} />
        ) : null}

        {searchMore && q && tab === 'kiot' ? (
          <Link
            href={`/tim-kiem?q=${encodeURIComponent(q)}&tab=kiot${params.sao === '4' ? '' : '&sao=4'}`}
            className={`w-fit rounded-full px-3 py-1.5 text-[12px] font-bold ${params.sao === '4' ? 'bg-amber-300 text-ink' : 'bg-white/10'}`}
            data-testid="kiot-stars-filter"
          >
            ★ 4+
          </Link>
        ) : null}

        {kiots.length ? (
          <div className="flex flex-col gap-2">
            {heading('kiot', kiots.length >= ALL.kiots)}
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="search-kiots">
              {kiots.map((k) => (
                <li key={k.slug}>
                  <KiotResultCard
                    kiot={k}
                    labels={{
                      products: t('market.kiotSearch.products', { count: k.products }),
                      price:
                        k.priceMin !== null && k.priceMax !== null
                          ? `${formatVnd(k.priceMin)} – ${formatVnd(k.priceMax)}`
                          : null,
                      distance: null,
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {q && (all || tab === 'san-pham') ? (
          <Link
            href={`/cho?q=${encodeURIComponent(q)}`}
            className="h-11 rounded-full border border-white/20 text-center text-[14px] font-black leading-[44px]"
          >
            {t('common.search.allInMarket')}
          </Link>
        ) : null}
      </section>
    </ClientMessages>
  );
}
