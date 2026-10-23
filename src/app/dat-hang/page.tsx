import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getCart, getSavedAddress } from '@/modules/orders';
import { CheckoutForm } from './CheckoutForm';

export const metadata: Metadata = { title: 'Đặt hàng', robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUser();
  const [cart, saved] = await Promise.all([getCart(user.id), getSavedAddress(user.id)]);
  if (cart.lineCount === 0 || !cart.canCheckout) redirect('/gio-hang');
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Đặt hàng</h1>
      <ul className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-4 text-sm">
        {cart.groups.map((g) => (
          <li key={g.kiot.id} className="flex justify-between gap-3">
            <span>
              <strong>{g.kiot.name}</strong> · {g.lines.reduce((s, l) => s + l.qty, 0)} món
              {g.shippingFee ? ` · ship ${formatVnd(g.shippingFee)}` : ' · miễn phí ship'}
            </span>
            <span className="font-bold">{formatVnd(g.total)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-black/10 pt-2 text-base">
          <strong>Tổng thanh toán</strong>
          <strong data-testid="checkout-total">{formatVnd(cart.grandTotal)}</strong>
        </li>
      </ul>
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
    </section>
  );
}
