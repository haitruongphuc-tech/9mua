import type { Metadata } from 'next';
import Link from 'next/link';
import { KiotCardList } from '@/components/market/KiotCardList';
import { CATEGORIES, PROVINCES } from '@/modules/kiot';
import { listKiots } from '@/modules/marketplace';

export const metadata: Metadata = {
  title: 'Danh bạ Kiot',
  description: 'Các Kiot đang bán trên Chợ 9MUA, lọc theo tỉnh/thành và ngành hàng.',
  alternates: { canonical: '/cho/kiot' },
};

const field =
  'h-11 rounded-xl border-2 border-black/15 bg-white px-3 text-base outline-none focus:border-brand-ink';

export default async function KiotDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tinh?: string; dm?: string; trang?: string }>;
}) {
  const sp = await searchParams;
  const province = PROVINCES.some((p) => p.slug === sp.tinh) ? sp.tinh : undefined;
  const category = CATEGORIES.some((c) => c.slug === sp.dm) ? sp.dm : undefined;
  const page = await listKiots({ province, category, cursor: sp.trang });
  const next = new URLSearchParams({
    ...(province ? { tinh: province } : {}),
    ...(category ? { dm: category } : {}),
    ...(page.nextCursor ? { trang: page.nextCursor } : {}),
  });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
      <h1 className="text-2xl font-extrabold">Danh bạ Kiot</h1>
      <form action="/cho/kiot" method="get" className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select name="tinh" defaultValue={province ?? ''} aria-label="Tỉnh/thành" className={field}>
          <option value="">Toàn quốc</option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="dm" defaultValue={category ?? ''} aria-label="Ngành hàng" className={field}>
          <option value="">Mọi ngành hàng</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="col-span-2 h-11 rounded-full border-2 border-brand-ink bg-brand px-6 font-extrabold text-brand-ink sm:col-span-1"
        >
          Lọc
        </button>
      </form>
      {page.items.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Chưa có Kiot phù hợp.</p>
      ) : (
        <KiotCardList items={page.items} />
      )}
      {page.nextCursor ? (
        <Link
          href={`/cho/kiot?${next.toString()}`}
          className="self-center rounded-full border-2 border-brand-ink px-6 py-2 font-bold"
        >
          Xem thêm
        </Link>
      ) : null}
    </section>
  );
}
