import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { formatVnd } from '@/lib/format';
import { kiotOrigin } from '@/lib/urls';
import { requireUser } from '@/modules/identity';
import { getCart } from '@/modules/orders';
import { CART_ERROR_MESSAGES, CART_PROBLEM_MESSAGES } from '@/modules/orders/messages';
import { removeAction, setQtyAction } from './actions';

export const metadata: Metadata = { title: 'Giỏ hàng', robots: { index: false } };

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-them'?: string }>;
}) {
  const user = await requireUser();
  const cart = await getCart(user.id);
  const params = await searchParams;
  const error = params.loi ? CART_ERROR_MESSAGES[params.loi as keyof typeof CART_ERROR_MESSAGES] : null;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Giỏ hàng</h1>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}
      {params['da-them'] && !error ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã thêm vào giỏ hàng.
        </p>
      ) : null}
      {cart.groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface-muted p-8 text-center">
          <p className="text-black/70">Giỏ hàng trống.</p>
          <Link
            href="/cho"
            className="rounded-full border-2 border-brand-ink bg-brand px-6 py-2 font-extrabold text-brand-ink"
          >
            Vào Chợ mua sắm
          </Link>
        </div>
      ) : (
        <>
          {cart.groups.map((g) => (
            <article
              key={g.kiot.id}
              className="rounded-2xl border-2 border-black/10 p-4"
              data-testid="cart-group"
            >
              <a href={kiotOrigin(g.kiot.slug)} className="mb-2 block font-extrabold">
                🏪 {g.kiot.name}
              </a>
              <ul className="flex flex-col divide-y divide-black/10">
                {g.lines.map((l) => (
                  <li key={l.productId} className="flex gap-3 py-3" data-testid="cart-line">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted">
                      {l.imageUrl ? (
                        <Image
                          src={l.imageUrl}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-bold">{l.name}</span>
                      <span className="text-sm text-black/70">{formatVnd(l.price)}</span>
                      {l.problem ? (
                        <span className="text-sm font-bold text-danger" data-testid="cart-problem">
                          {CART_PROBLEM_MESSAGES[l.problem]}
                          {l.problem === 'EXCEEDS_STOCK' ? ` (còn ${l.stock})` : ''}
                        </span>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <form
                          action={setQtyAction.bind(null, l.productId)}
                          className="flex items-center gap-1"
                        >
                          <label className="sr-only" htmlFor={`q-${l.productId}`}>
                            Số lượng
                          </label>
                          <input
                            id={`q-${l.productId}`}
                            name="qty"
                            type="number"
                            min={0}
                            defaultValue={l.qty}
                            className="h-9 w-16 rounded-lg border-2 border-black/15 text-center"
                          />
                          <button className="h-9 rounded-lg border-2 border-black/15 px-2 text-sm font-bold">
                            Cập nhật
                          </button>
                        </form>
                        <form action={removeAction.bind(null, l.productId)}>
                          <button
                            className="h-9 px-2 text-sm font-bold text-danger"
                            aria-label={`Xoá ${l.name}`}
                          >
                            Xoá
                          </button>
                        </form>
                      </div>
                    </div>
                    <span className="shrink-0 font-extrabold">{formatVnd(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <dt className="text-black/60">Tiền hàng</dt>
                <dd className="text-right">{formatVnd(g.subtotal)}</dd>
                <dt className="text-black/60">Phí ship</dt>
                <dd className="text-right">{g.shippingFee ? formatVnd(g.shippingFee) : 'Miễn phí'}</dd>
              </dl>
            </article>
          ))}
          <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-2xl border-2 border-brand-ink bg-white p-4">
            <span>
              <span className="block text-sm text-black/60">Tổng thanh toán</span>
              <span className="text-xl font-extrabold" data-testid="cart-total">
                {formatVnd(cart.grandTotal)}
              </span>
            </span>
            {cart.canCheckout ? (
              <Link
                href="/dat-hang"
                className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
                data-testid="go-checkout"
              >
                Đặt hàng
              </Link>
            ) : (
              <span className="max-w-40 text-right text-sm font-bold text-danger">
                Sửa các món được đánh dấu để đặt hàng
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
