import Link from 'next/link';
import { CATEGORIES, PROVINCES } from '@/modules/kiot';
import { SORTS, toSearchString, type SearchParams } from '@/modules/marketplace';

const field =
  'h-11 rounded-xl border-2 border-black/15 bg-white px-3 text-base outline-none focus:border-brand-ink';

const href = (p: Partial<SearchParams>) => {
  const qs = toSearchString({ ...p, cursor: undefined });
  return qs ? `/cho?${qs}` : '/cho';
};

// Ô tìm, hàng danh mục và bộ lọc. Tất cả là form GET / link, nên trạng thái nằm trên URL.
export function MarketFilters({ params }: { params: SearchParams }) {
  return (
    <div className="flex flex-col gap-3">
      <form action="/cho" method="get" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Tìm sản phẩm trên Chợ…"
          aria-label="Tìm sản phẩm"
          className={`${field} min-w-0 flex-1`}
          data-testid="market-search"
        />
        {params.category ? <input type="hidden" name="dm" value={params.category} /> : null}
        {params.province ? <input type="hidden" name="tinh" value={params.province} /> : null}
        <button
          type="submit"
          className="rounded-full border-2 border-brand-ink bg-brand px-5 font-extrabold text-brand-ink"
        >
          Tìm
        </button>
      </form>
      <nav aria-label="Danh mục" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 pb-1 text-sm font-bold">
          <li>
            <Link
              href={href({ ...params, category: undefined })}
              className={`block whitespace-nowrap rounded-full border-2 px-3 py-1.5 ${params.category ? 'border-black/10' : 'border-brand-ink bg-brand/15'}`}
            >
              Tất cả
            </Link>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={href({ ...params, category: c.slug })}
                aria-current={params.category === c.slug ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-full border-2 px-3 py-1.5 ${params.category === c.slug ? 'border-brand-ink bg-brand/15' : 'border-black/10'}`}
              >
                <span aria-hidden>{c.icon}</span> {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <details
        className="rounded-2xl border-2 border-black/10 p-3"
        open={Boolean(params.province || params.priceMin || params.priceMax)}
      >
        <summary className="cursor-pointer text-sm font-bold">Bộ lọc và sắp xếp</summary>
        <form action="/cho" method="get" className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          {params.category ? <input type="hidden" name="dm" value={params.category} /> : null}
          <label className="col-span-2 flex flex-col gap-1 font-bold">
            Tỉnh/thành của Kiot
            <select
              name="tinh"
              defaultValue={params.province ?? ''}
              className={field}
              data-testid="filter-province"
            >
              <option value="">Toàn quốc</option>
              {PROVINCES.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-bold">
            Giá từ
            <input name="giatu" inputMode="numeric" defaultValue={params.priceMin} className={field} />
          </label>
          <label className="flex flex-col gap-1 font-bold">
            Giá đến
            <input name="giaden" inputMode="numeric" defaultValue={params.priceMax} className={field} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 font-bold">
            Sắp xếp
            <select name="sx" defaultValue={params.sort} className={field} data-testid="filter-sort">
              {SORTS.filter((s) => s.value !== 'phu-hop' || params.q).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="col-span-2 h-11 rounded-full border-2 border-brand-ink bg-brand font-extrabold text-brand-ink"
          >
            Áp dụng
          </button>
        </form>
      </details>
    </div>
  );
}
