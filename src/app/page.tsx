import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { KiotCardList } from '@/components/market/KiotCardList';
import { MarketProductCard } from '@/components/market/MarketProductCard';
import { VideoGrid } from '@/components/video/VideoGrid';
import { formatVnd } from '@/lib/format';
import { cached } from '@/lib/ttl-cache';
import { getKiotFee } from '@/modules/billing';
import { getHotVideos } from '@/modules/creator';
import { CATEGORIES } from '@/modules/kiot';
import { getHomeSections } from '@/modules/marketplace';

// Dữ liệu trang chủ cache 60 giây (SPEC-marketplace.md mục 8).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { title: '9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất', url: '/' },
};

function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold">{title}</h2>
        {href ? (
          <Link href={href} className="text-sm font-bold text-brand-deep">
            Xem tất cả →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const [home, fee, hot] = await Promise.all([
    cached('home', 60, getHomeSections),
    cached('kiot-fee', 60, getKiotFee),
    cached('hot-videos', 60, () => getHotVideos(8)),
  ]);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-brand/10 px-4 py-8 text-center">
        <Image src="/brand/9mua-logo.png" alt="Logo 9MUA" width={107} height={118} priority />
        <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Kiếm tiền trên 9mua.com dễ và nhanh nhất
        </h1>
        <form action="/cho" method="get" role="search" className="flex w-full max-w-md gap-2">
          <input
            type="search"
            name="q"
            placeholder="Bạn muốn mua gì?"
            aria-label="Tìm sản phẩm"
            className="h-12 min-w-0 flex-1 rounded-full border-2 border-brand-ink bg-white px-5 text-base outline-none"
            data-testid="home-search"
          />
          <button
            type="submit"
            className="rounded-full border-2 border-brand-ink bg-brand px-5 font-extrabold text-brand-ink"
          >
            Tìm
          </button>
        </form>
        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <Link
            href="/dang-ky?next=/kiot-cua-toi/tao"
            className="flex-1 rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
          >
            Tạo Kiot – {formatVnd(fee)}/năm
          </Link>
          <Link
            href="/cho"
            className="flex-1 rounded-full border-2 border-brand-ink bg-white px-6 py-3 font-extrabold"
          >
            Vào Chợ
          </Link>
        </div>
        <p className="text-sm text-black/70" data-testid="home-stats">
          {home.stats.kiots.toLocaleString('vi-VN')} Kiot đang bán ·{' '}
          {home.stats.products.toLocaleString('vi-VN')} sản phẩm
        </p>
      </section>

      <nav aria-label="Danh mục">
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/cho/${c.slug}`}
                className="flex flex-col items-center gap-1 rounded-2xl p-2 text-center text-xs font-bold hover:bg-surface-muted"
              >
                <span aria-hidden className="text-2xl">
                  {c.icon}
                </span>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {home.bestSellers.length > 0 ? (
        <Section title="Bán chạy" href="/cho?sx=ban-chay">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {home.bestSellers.map((p) => (
              <MarketProductCard key={p.id} p={p} />
            ))}
          </ul>
        </Section>
      ) : null}

      {hot.length > 0 ? (
        <Section title="Video hot" href="/video">
          <VideoGrid videos={hot.slice(0, 6)} showAuthor />
        </Section>
      ) : null}

      {home.newest.length > 0 ? (
        <Section title="Mới lên Chợ" href="/cho">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {home.newest.map((p) => (
              <MarketProductCard key={p.id} p={p} />
            ))}
          </ul>
        </Section>
      ) : null}

      {home.featuredKiots.length > 0 ? (
        <Section title={home.featuredLabel === 'top' ? 'Kiot nổi bật' : 'Kiot mới mở'} href="/cho/kiot">
          <KiotCardList items={home.featuredKiots} />
        </Section>
      ) : null}
    </div>
  );
}
