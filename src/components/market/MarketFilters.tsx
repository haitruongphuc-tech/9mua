import { Search } from 'lucide-react';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { CATEGORIES, PROVINCES } from '@/modules/kiot';
import { SORTS, toSearchString, type SearchParams } from '@/modules/marketplace';

const field =
  'h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand';
const pill =
  'block h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[12px] font-bold leading-[30px]';
const pillOn = 'border-brand bg-brand text-white';
const pillOff = 'border-white/15 bg-white/5 text-white/70 hover:text-white';

const href = (p: Partial<SearchParams>) => {
  const qs = toSearchString({ ...p, cursor: undefined });
  return qs ? `/cho?${qs}` : '/cho';
};

// Ô tìm, hàng danh mục và bộ lọc kiểu V4. Tất cả là form GET / link, nên trạng thái nằm trên URL.
export async function MarketFilters({ params }: { params: SearchParams }) {
  const t = await getT();
  return (
    <div className="flex flex-col gap-3">
      <form action="/cho" method="get" role="search" className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4">
          <Search className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder={t('market.search.placeholder')}
            aria-label={t('market.search.label')}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
            data-testid="market-search"
          />
        </label>
        {params.category ? <input type="hidden" name="dm" value={params.category} /> : null}
        {params.province ? <input type="hidden" name="tinh" value={params.province} /> : null}
        <button type="submit" className="h-11 shrink-0 rounded-full bg-brand px-5 text-[14px] font-black">
          {t('market.search.button')}
        </button>
      </form>
      <nav aria-label={t('market.cats')} className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1">
          <li>
            <Link
              href={href({ ...params, category: undefined })}
              className={`${pill} ${params.category ? pillOff : pillOn}`}
            >
              {t('market.all')}
            </Link>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={href({ ...params, category: c.slug })}
                aria-current={params.category === c.slug ? 'page' : undefined}
                className={`${pill} ${params.category === c.slug ? pillOn : pillOff}`}
              >
                <span aria-hidden>{c.icon}</span> {t(`market.cat.${c.slug}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <details
        className="rounded-[18px] border border-white/10 bg-white/5 p-3"
        open={Boolean(params.province || params.priceMin || params.priceMax)}
      >
        <summary className="cursor-pointer text-[13px] font-bold">{t('market.filters')}</summary>
        <form action="/cho" method="get" className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          {params.category ? <input type="hidden" name="dm" value={params.category} /> : null}
          <label className="col-span-2 flex flex-col gap-1 font-bold text-white/70">
            {t('market.province')}
            <select
              name="tinh"
              defaultValue={params.province ?? ''}
              className={field}
              data-testid="filter-province"
            >
              <option value="">{t('market.nationwide')}</option>
              {PROVINCES.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-bold text-white/70">
            {t('market.priceFrom')}
            <input name="giatu" inputMode="numeric" defaultValue={params.priceMin} className={field} />
          </label>
          <label className="flex flex-col gap-1 font-bold text-white/70">
            {t('market.priceTo')}
            <input name="giaden" inputMode="numeric" defaultValue={params.priceMax} className={field} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 font-bold text-white/70">
            {t('market.sort')}
            <select name="sx" defaultValue={params.sort} className={field} data-testid="filter-sort">
              {SORTS.filter((s) => s.value !== 'phu-hop' || params.q).map((s) => (
                <option key={s.value} value={s.value}>
                  {t(`market.sort.${s.value}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="col-span-2 h-11 rounded-full bg-brand text-[14px] font-black text-white"
          >
            {t('market.apply')}
          </button>
        </form>
      </details>
    </div>
  );
}
