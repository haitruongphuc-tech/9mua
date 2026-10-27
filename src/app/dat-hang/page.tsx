import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getCart, getSavedAddress } from '@/modules/orders';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = { title: 'Đặt hàng', robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser();
  const [cart, saved, t] = await Promise.all([getCart(user.id), getSavedAddress(user.id), getT()]);
  if (cart.lineCount === 0 || !cart.canCheckout) redirect('/gio-hang');
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('shop.checkout.title')}</h1>
      <ul className="flex flex-col gap-2 rounded-[18px] bg-white p-4 text-[13px] text-black">
        {cart.groups.map((g) => (
          <li key={g.kiot.id} className="flex justify-between gap-3">
            <span>
              <strong>{g.kiot.name}</strong> ·{' '}
              {t('shop.checkout.items', { count: g.lines.reduce((s, l) => s + l.qty, 0) })} ·{' '}
              {g.shippingFee
                ? t('shop.checkout.ship', { fee: formatVnd(g.shippingFee) })
                : t('shop.checkout.freeShip')}
            </span>
            <span className="font-bold">{formatVnd(g.total)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-black/10 pt-2 text-base">
          <strong>{t('shop.cart.total')}</strong>
          <strong className="text-brand" data-testid="checkout-total">
            {formatVnd(cart.grandTotal)}
          </strong>
        </li>
      </ul>
      <ClientMessages prefixes={['shop.checkout.']}>
        <CheckoutForm
          saved={
            saved
              ? {
                  name: saved.name,
                  phone: saved.phone,
                  province: saved.province,
                  district: saved.district,
                  ward: saved.ward,
                  line: saved.line,
                }
              : null
          }
          kiots={cart.groups.map((g) => ({ id: g.kiot.id, name: g.kiot.name }))}
          totalText={formatVnd(cart.grandTotal)}
        />
      </ClientMessages>
    </section>
  );
}
