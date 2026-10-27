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
}: {
  productId: string;
  sourceVideoId?: string;
  maxQty: number;
  cartUrl: string;
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
