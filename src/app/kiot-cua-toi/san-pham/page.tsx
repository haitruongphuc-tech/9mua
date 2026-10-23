import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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
  const products = await listProductsForOwner(user.id);
  const params = await searchParams;
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">
          Sản phẩm{' '}
          <span className="text-black/50">
            ({products.length}/{MAX_PRODUCTS_PER_KIOT})
          </span>
        </h1>
        <Link
          href="/kiot-cua-toi/san-pham/moi"
          className="rounded-full border-2 border-brand-ink bg-brand px-4 py-2 font-extrabold text-brand-ink"
        >
          + Thêm
        </Link>
      </header>
      {params['da-luu'] || params['da-xoa'] ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          {params['da-xoa'] ? 'Đã xoá sản phẩm.' : 'Đã lưu sản phẩm.'}
        </p>
      ) : null}
      {products.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">
          Chưa có sản phẩm nào. Bấm “+ Thêm” để đăng sản phẩm đầu tiên.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10" data-testid="product-list">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/kiot-cua-toi/san-pham/${p.id}`} className="flex items-center gap-3 py-3">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
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
                  <span className="block truncate font-bold">{p.name}</span>
                  <span className="block text-sm text-black/70">
                    {formatVnd(p.price)} · Kho: {p.stock}
                  </span>
                </span>
                {!p.visible ? (
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-bold">Đang ẩn</span>
                ) : null}
                {p.hiddenByAdminAt ? (
                  <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                    Bị gỡ
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
