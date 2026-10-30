import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { MarketProductCard } from '@/components/market/MarketProductCard';
import { Avatar } from '@/components/ui/Avatar';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { searchVideos } from '@/modules/creator';
import { searchPublicUsers } from '@/modules/identity';
import { searchProducts } from '@/modules/marketplace';
import { searchHashtags, trendingHashtags } from '@/modules/social';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('common.search.title'), robots: { index: false } };
}

const TABS = ['tat-ca', 'tai-khoan', 'video', 'hashtag', 'san-pham'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL = {
  'tat-ca': 'common.search.tab.all',
  'tai-khoan': 'common.search.tab.users',
  video: 'common.search.tab.videos',
  hashtag: 'common.search.tab.hashtags',
  'san-pham': 'common.search.tab.products',
} as const;
// Tab "Tất cả": 3 tài khoản, 6 video, 5 hashtag, 6 sản phẩm; tab riêng: 30 kết quả (SPEC-social.md bổ sung 30/10, A3).
const ALL = { users: 3, videos: 6, hashtags: 5, products: 6 };
const FULL = 30;

// Tìm kiếm chung: tài khoản, video, hashtag, sản phẩm. Tìm không dấu, không phân biệt hoa thường.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 100);
  const tab: Tab = TABS.find((x) => x === params.tab) ?? 'tat-ca';
  const all = tab === 'tat-ca';
  const want = (t: Tab, n: number) => (q && (all || tab === t) ? n : 0);
  const [t, users, videos, hashtags, products, trending] = await Promise.all([
    getT(),
    want('tai-khoan', 1) ? searchPublicUsers(q, all ? ALL.users : FULL) : Promise.resolve([]),
    want('video', 1) ? searchVideos(q, all ? ALL.videos : FULL) : Promise.resolve([]),
    want('hashtag', 1) ? searchHashtags(q, all ? ALL.hashtags : FULL) : Promise.resolve([]),
    want('san-pham', 1)
      ? searchProducts({ q, sort: 'phu-hop' }, all ? ALL.products : FULL).then((p) => p.items)
      : Promise.resolve([]),
    q ? Promise.resolve([]) : trendingHashtags(10),
  ]);
  const href = (to: Tab) => `/tim-kiem?q=${encodeURIComponent(q)}${to === 'tat-ca' ? '' : `&tab=${to}`}`;
  const nothing = q && !users.length && !videos.length && !hashtags.length && !products.length;

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
        <form
          action="/tim-kiem"
          role="search"
          className="flex h-11 items-center gap-2 rounded-full bg-white/10 px-4"
        >
          <Search className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            enterKeyHint="search"
            maxLength={100}
            autoFocus={!q}
            placeholder={t('common.search.placeholder')}
            aria-label={t('common.search.label')}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
          />
          {tab === 'tat-ca' ? null : <input type="hidden" name="tab" value={tab} />}
        </form>

        {q ? (
          <nav
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
            aria-label={t('common.search.title')}
          >
            {TABS.map((x) => (
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
