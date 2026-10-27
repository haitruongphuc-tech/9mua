import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, listProductsForOwner, MAX_PRODUCTS_PER_KIOT } from '@/modules/kiot';

export const metadata: Metadata = { title: 'Sản phẩm', robots: { index: false } };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-luu'?: string; 'da-xoa'?: string }>;
}) {
  const user = await requireUser();
  if (!(await getKiotByOwner(user.id))) redirect('/kiot-cua-toi/tao');
  const [products, params, t] = await Promise.all([listProductsForOwner(user.id), searchParams, getT()]);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black">
          {t('seller.products.title')}{' '}
          <span className="text-white/50">
            ({products.length}/{MAX_PRODUCTS_PER_KIOT})
          </span>
        </h1>
        <Link
          href="/kiot-cua-toi/san-pham/moi"
          className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-[13px] font-black"
        >
          {t('seller.products.add')}
        </Link>
      </header>
      {params['da-luu'] || params['da-xoa'] ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t(params['da-xoa'] ? 'seller.products.deleted' : 'seller.products.saved')}
        </p>
      ) : null}
      {products.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('seller.products.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="product-list">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/kiot-cua-toi/san-pham/${p.id}`}
                className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 p-2 hover:bg-white/10"
              >
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px] bg-white/10">
                  {p.images[0] ? (
                    <Image
                      src={p.images[0].thumbUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{p.name}</span>
                  <span className="block text-[12px] text-white/60">
                    {t('seller.products.stock', { price: formatVnd(p.price), stock: p.stock })}
                  </span>
                </span>
                {!p.visible ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">
                    {t('seller.products.hidden')}
                  </span>
                ) : null}
                {p.hiddenByAdminAt ? (
                  <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                    {t('seller.products.removed')}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
