'use client';

import { useState } from 'react';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { addToCartAction } from '@/components/orders/add-to-cart-action';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/client';

// Nút "+ Giỏ" trên thẻ sản phẩm trắng của trang Kiot V4: thêm 1 món, chưa đăng nhập thì sang trang đăng nhập.
export function AddToCartPill({ productId, name }: { productId: string; name: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function add() {
    if (busy) return;
    setBusy(true);
    const form = new FormData();
    form.set('qty', '1');
    try {
      const result = await addToCartAction(productId, null, {}, form);
      toast(result.message ?? (result.ok ? t('profile.addedToCart') : t('profile.cartFailed')));
      if (result.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void add()}
      disabled={busy}
      aria-label={t('profile.addToCartOf', { name })}
      className="h-8 shrink-0 rounded-full bg-black px-3 text-[11px] font-bold text-white disabled:opacity-60"
    >
      {t('profile.addToCart')}
    </button>
  );
}
