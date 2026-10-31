import type { Metadata } from 'next';
import Link from 'next/link';
import { KiotCardList } from '@/components/market/KiotCardList';
import { getT } from '@/i18n/server';
import { CATEGORIES, PROVINCES } from '@/modules/kiot';
import { listKiots } from '@/modules/marketplace';
import { isFeatureOn } from '@/lib/features';

export const metadata: Metadata = {
  title: 'Danh bạ Kiot',
  description: 'Các Kiot đang bán trên Chợ 9MUA, lọc theo tỉnh/thành và ngành hàng.',
  alternates: { canonical: '/cho/kiot' },
};

const field =
  'h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand';

export default async function KiotDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tinh?: string; dm?: string; trang?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const province = PROVINCES.some((p) => p.slug === sp.tinh) ? sp.tinh : undefined;
  const category = CATEGORIES.some((c) => c.slug === sp.dm) ? sp.dm : undefined;
  // Ô tìm Kiot theo tên (SPEC-marketplace.md V5.1), công tắc search_more.
  const q = (await isFeatureOn('search_more')) ? (sp.q ?? '').trim().slice(0, 100) : '';
  const [page, t] = await Promise.all([listKiots({ province, category, q, cursor: sp.trang }), getT()]);
  const next = new URLSearchParams({
    ...(province ? { tinh: province } : {}),
    ...(category ? { dm: category } : {}),
    ...(q ? { q } : {}),
    ...(page.nextCursor ? { trang: page.nextCursor } : {}),
  });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
      <h1 className="font-display text-[22px] font-black">{t('market.dir.title')}</h1>
      <form
        action="/cho/kiot"
        method="get"
        className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder={t('market.kiotSearch.placeholder')}
          aria-label={t('market.kiotSearch.placeholder')}
          className={`${field} col-span-2 sm:col-span-1`}
          data-testid="kiot-dir-search"
        />
        <select
          name="tinh"
          defaultValue={province ?? ''}
          aria-label={t('market.dir.province')}
          className={field}
        >
          <option value="">{t('market.nationwide')}</option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          name="dm"
          defaultValue={category ?? ''}
          aria-label={t('market.dir.category')}
          className={field}
        >
          <option value="">{t('market.dir.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {t(`market.cat.${c.slug}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="col-span-2 h-11 rounded-full bg-brand px-6 text-[14px] font-black text-white sm:col-span-1"
        >
          {t('market.dir.filter')}
        </button>
      </form>
      {page.items.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('market.dir.empty')}
        </p>
      ) : (
        <KiotCardList items={page.items} />
      )}
      {page.nextCursor ? (
        <Link
          href={`/cho/kiot?${next.toString()}`}
          className="inline-flex h-10 items-center self-center rounded-full border border-white/20 px-6 text-[13px] font-bold"
        >
          {t('market.more')}
        </Link>
      ) : null}
    </section>
  );
}
