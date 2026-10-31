'use client';

import { useActionState, useEffect } from 'react';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { useT } from '@/i18n/client';
import { addToCartAction, type AddToCartState } from './add-to-cart-action';

export function AddToCart({
  productId,
  sourceVideoId,
  maxQty,
  cartUrl,
  variants,
}: {
  productId: string;
  sourceVideoId?: string;
  maxQty: number;
  cartUrl: string;
  // Biến thể (SPEC-kiot.md V5.6): có thì phải chọn trước khi thêm vào giỏ.
  variants?: { id: string; label: string; priceText: string; stock: number }[];
}) {
  const t = useT();
  const [state, action] = useActionState<AddToCartState, FormData>(
    addToCartAction.bind(null, productId, sourceVideoId ?? null),
    {},
  );
  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
  }, [state]);
  if (maxQty <= 0)
    return <p className="rounded-[14px] bg-white/10 px-4 py-3 font-bold">{t('shop.add.soldOut')}</p>;
  return (
    <form action={action} className="flex flex-col gap-2">
      {variants?.length ? (
        <select
          name="variantId"
          required
          defaultValue=""
          aria-label={t('shop.add.variant')}
          className="h-12 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] font-bold text-white"
          data-testid="variant-select"
        >
          <option value="" disabled>
            {t('shop.add.variant')}
          </option>
          {variants.map((v) => (
            <option key={v.id} value={v.id} disabled={v.stock <= 0}>
              {v.label} · {v.priceText}
              {v.stock <= 0 ? ` · ${t('shop.add.soldOut')}` : ''}
            </option>
          ))}
        </select>
      ) : null}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`qty-${productId}`}>
          {t('shop.cart.qty')}
        </label>
        <input
          id={`qty-${productId}`}
          name="qty"
          type="number"
          min={1}
          max={maxQty}
          defaultValue={1}
          inputMode="numeric"
          className="h-12 w-20 rounded-full border border-white/15 bg-white/10 text-center text-base font-bold text-white outline-none focus:border-brand"
        />
        <div className="flex-1 [&>button]:w-full">
          <SubmitButton pendingText={t('shop.add.adding')}>{t('shop.add.button')}</SubmitButton>
        </div>
      </div>
      {state.message ? (
        <p
          role="status"
          data-testid="cart-message"
          className={`text-[13px] font-bold ${state.ok ? 'text-green-400' : 'text-red-400'}`}
        >
          {state.message}{' '}
          {state.ok ? (
            <a href={cartUrl} className="underline">
              {t('shop.add.viewCart')}
            </a>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
