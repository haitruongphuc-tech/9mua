'use client';

import { useActionState, useEffect } from 'react';
import { ME_CHANGED_EVENT } from '@/components/UserMenu';
import { SubmitButton } from '@/components/ui/SubmitButton';
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
  const [state, action] = useActionState<AddToCartState, FormData>(
    addToCartAction.bind(null, productId, sourceVideoId ?? null),
    {},
  );
  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
  }, [state]);
  if (maxQty <= 0) return <p className="rounded-xl bg-black/5 px-4 py-3 font-bold">Hết hàng</p>;
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`qty-${productId}`}>
          Số lượng
        </label>
        <input
          id={`qty-${productId}`}
          name="qty"
          type="number"
          min={1}
          max={maxQty}
          defaultValue={1}
          inputMode="numeric"
          className="h-12 w-20 rounded-xl border-2 border-black/15 text-center text-base font-bold"
        />
        <div className="flex-1 [&>button]:w-full">
          <SubmitButton pendingText="Đang thêm…">🛒 Thêm vào giỏ</SubmitButton>
        </div>
      </div>
      {state.message ? (
        <p
          role="status"
          data-testid="cart-message"
          className={`text-sm font-bold ${state.ok ? 'text-success' : 'text-danger'}`}
        >
          {state.message}{' '}
          {state.ok ? (
            <a href={cartUrl} className="underline">
              Xem giỏ hàng
            </a>
          ) : null}
        </p>
      ) : null}
    </form>
  );
}
