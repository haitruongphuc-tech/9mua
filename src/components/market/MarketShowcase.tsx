import Link from 'next/link';
import { KiotCardList } from '@/components/market/KiotCardList';
import { MarketProductCard } from '@/components/market/MarketProductCard';
import { LogoV4 } from '@/components/LogoV4';
import { VideoGrid } from '@/components/video/VideoGrid';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import { cached } from '@/lib/ttl-cache';
import { getKiotFee } from '@/modules/billing';
import { getHotVideos } from '@/modules/creator';
import { CATEGORIES } from '@/modules/kiot';
import { getHomeSections } from '@/modules/marketplace';

async function Section({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const t = await getT();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[18px] font-black">{title}</h2>
        {href ? (
          <Link href={href} className="text-[13px] font-bold text-brand">
            {t('market.seeAll')}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// Các khối của trang chủ cũ (SPEC-marketplace.md mục 1). Từ T40 trang chủ là feed video, nên khối này nằm ở
// đầu Chợ (variant "cho"); trang chủ chỉ dùng bản đầy đủ (variant "home") khi chưa có video nào.
// Dữ liệu cache 60 giây.
export async function MarketShowcase({ variant }: { variant: 'home' | 'cho' }) {
  const [home, fee, hot, t] = await Promise.all([
    cached('home', 60, getHomeSections),
    cached('kiot-fee', 60, getKiotFee),
    cached('hot-videos', 60, () => getHotVideos(8)),
    getT(),
  ]);
  const stats = (
    <p className="text-[13px] text-white/70" data-testid="home-stats">
      {t('market.stats', {
        kiots: home.stats.kiots.toLocaleString(t.lang),
        products: home.stats.products.toLocaleString(t.lang),
      })}
    </p>
  );
  const createKiot = (
    <Link
      href="/dang-ky?next=/kiot-cua-toi/tao"
      className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-[14px] font-black"
    >
      {t('market.createKiot', { fee: formatVnd(fee) })}
    </Link>
  );

  return (
    <div className="flex flex-col gap-8">
      {variant === 'home' ? (
        <>
          <section className="flex flex-col items-center gap-4 rounded-[24px] bg-gradient-to-br from-brand/25 to-transparent px-4 py-8 text-center">
            <LogoV4 size={96} />
            <h1 className="max-w-xl font-display text-3xl font-black leading-tight sm:text-4xl">
              {t('market.heroTitle')}
            </h1>
            <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col">{createKiot}</div>
              <Link
                href="/cho"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-white px-6 text-[14px] font-black text-black"
              >
                {t('market.goMarket')}
              </Link>
            </div>
            {stats}
          </section>
          <nav aria-label={t('market.cats')}>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/cho/${c.slug}`}
                    className="flex flex-col items-center gap-1 rounded-[16px] p-2 text-center text-[11px] font-bold hover:bg-white/5"
                  >
                    <span aria-hidden className="text-2xl">
                      {c.icon}
                    </span>
                    {t(`market.cat.${c.slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-[18px] border border-brand/40 bg-brand/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          {stats}
          {createKiot}
        </div>
      )}

      {home.bestSellers.length > 0 ? (
        <Section title={t('market.bestSellers')} href="/cho?sx=ban-chay">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {home.bestSellers.map((p) => (
              <MarketProductCard key={p.id} p={p} />
            ))}
          </ul>
        </Section>
      ) : null}

      {hot.length > 0 ? (
        <Section title={t('market.hotVideos')} href="/video">
          <VideoGrid videos={hot.slice(0, 6)} showAuthor />
        </Section>
      ) : null}

      {variant === 'home' && home.newest.length > 0 ? (
        <Section title={t('market.newest')} href="/cho">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {home.newest.map((p) => (
              <MarketProductCard key={p.id} p={p} />
            ))}
          </ul>
        </Section>
      ) : null}

      {home.featuredKiots.length > 0 ? (
        <Section
          title={t(home.featuredLabel === 'top' ? 'market.featuredTop' : 'market.featuredNew')}
          href="/cho/kiot"
        >
          <KiotCardList items={home.featuredKiots} />
        </Section>
      ) : null}
    </div>
  );
}
