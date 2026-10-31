import { Store } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import { kiotOrigin } from '@/lib/urls';
import { requireUser } from '@/modules/identity';
import { getCart } from '@/modules/orders';
import { removeAction, setQtyAction } from './actions';

export const metadata: Metadata = { title: 'Giỏ hàng', robots: { index: false } };

const CART_ERRORS = ['UNAVAILABLE', 'OWN_PRODUCT', 'CART_FULL', 'EXCEEDS_STOCK', 'INVALID_QTY'] as const;

// Giỏ hàng kiểu V4: nhóm theo Kiot trên nền đen, thẻ tổng tiền trắng, nút cam (SPEC-orders.md mục 1).
export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-them'?: string }>;
}) {
  const user = await requireUser();
  const [cart, params, t] = await Promise.all([getCart(user.id), searchParams, getT()]);
  const code = CART_ERRORS.find((c) => c === params.loi);
  const error = code ? t(`shop.cart.err.${code}`) : null;

  return (
    <section className="mx-auto w-full max-w-[900px] px-4 py-4">
      <h1 className="font-display text-[22px] font-black">{t('shop.cart.title')}</h1>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {error}
        </p>
      ) : null}
      {params['da-them'] && !error ? (
        <p
          role="status"
          className="mt-3 rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('shop.cart.added')}
        </p>
      ) : null}
      {cart.groups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-white/60">{t('shop.cart.empty')}</p>
          <Link
            href="/cho"
            className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[13px] font-black"
          >
            {t('shop.cart.goMarket')}
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {cart.groups.map((g) => (
              <article
                key={g.kiot.id}
                className="rounded-[18px] border border-white/10 bg-white/5 p-3"
                data-testid="cart-group"
              >
                <a href={kiotOrigin(g.kiot.slug)} className="flex items-center gap-2 text-[14px] font-black">
                  <Store className="h-4 w-4 text-brand" aria-hidden /> {g.kiot.name}
                </a>
                <ul className="mt-2 space-y-2">
                  {g.lines.map((l) => (
                    <li
                      key={l.productId}
                      className="flex gap-3 rounded-[12px] bg-black/40 p-2"
                      data-testid="cart-line"
                    >
                      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
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
                        <span className="truncate text-[13px] font-bold">
                          {l.name}
                          {l.variantLabel ? (
                            <span className="ml-1 font-normal text-white/60" data-testid="cart-variant">
                              · {l.variantLabel}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[13px] font-black text-brand">{formatVnd(l.price)}</span>
                        {l.problem ? (
                          <span className="text-[12px] font-bold text-red-400" data-testid="cart-problem">
                            {t(`shop.cart.problem.${l.problem}`)}
                            {l.problem === 'EXCEEDS_STOCK'
                              ? ` ${t('shop.cart.left', { stock: l.stock })}`
                              : ''}
                          </span>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <form
                            action={setQtyAction.bind(null, l.productId)}
                            className="flex items-center gap-1"
                          >
                            <label className="sr-only" htmlFor={`q-${l.productId}`}>
                              {t('shop.cart.qty')}
                            </label>
                            <input
                              id={`q-${l.productId}`}
                              name="qty"
                              type="number"
                              min={0}
                              defaultValue={l.qty}
                              className="h-8 w-14 rounded-full border border-white/15 bg-white/10 text-center text-[13px] font-bold text-white outline-none focus:border-brand"
                            />
                            <button className="h-8 rounded-full bg-white/10 px-3 text-[12px] font-bold">
                              {t('shop.cart.update')}
                            </button>
                          </form>
                          <form action={removeAction.bind(null, l.productId)}>
                            <button
                              className="h-8 px-2 text-[12px] font-bold text-red-400"
                              aria-label={t('shop.cart.removeOf', { name: l.name })}
                            >
                              {t('shop.cart.remove')}
                            </button>
                          </form>
                        </div>
                      </div>
                      <span className="shrink-0 text-right text-[13px] font-black">
                        {formatVnd(l.price * l.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-[12px]">
                  <dt className="text-white/50">{t('shop.cart.subtotal')}</dt>
                  <dd className="text-right">{formatVnd(g.subtotal)}</dd>
                  <dt className="text-white/50">{t('shop.cart.shipping')}</dt>
                  <dd className="text-right">
                    {g.shippingFee ? formatVnd(g.shippingFee) : t('shop.cart.freeShip')}
                  </dd>
                </dl>
              </article>
            ))}
          </div>
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] h-fit rounded-[18px] bg-white p-4 text-black md:top-[80px]">
            <p className="text-[12px] text-zinc-500">{t('shop.cart.total')}</p>
            <p className="text-[22px] font-black text-brand" data-testid="cart-total">
              {formatVnd(cart.grandTotal)}
            </p>
            {cart.canCheckout ? (
              <Link
                href="/dat-hang"
                className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-brand font-black text-white"
                data-testid="go-checkout"
              >
                {t('shop.cart.checkout')}
              </Link>
            ) : (
              <p className="mt-3 text-[13px] font-bold text-danger">{t('shop.cart.fixFirst')}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
