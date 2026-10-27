'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { placeOrderAction, type CheckoutFormState } from './actions';

type Saved = {
  name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  line: string;
} | null;

const FIELDS = [
  { name: 'name', id: 'a-name', autoComplete: 'name' },
  { name: 'phone', id: 'a-phone', autoComplete: 'tel', inputMode: 'tel' },
  { name: 'province', id: 'a-province', autoComplete: 'address-level1' },
  { name: 'district', id: 'a-district', autoComplete: 'address-level2' },
  { name: 'ward', id: 'a-ward', autoComplete: 'address-level3' },
  { name: 'line', id: 'a-line', autoComplete: 'street-address' },
] as const;

export function CheckoutForm({
  saved,
  kiots,
  totalText,
}: {
  saved: Saved;
  kiots: { id: string; name: string }[];
  totalText: string;
}) {
  const t = useT();
  const [state, action] = useActionState<CheckoutFormState, FormData>(placeOrderAction, {});
  const v: Record<string, string | undefined> =
    state.values ?? (saved ? { ...saved, phone: '0' + saved.phone.replace(/^\+84/, '') } : {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message ? (
        <p role="alert" className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300">
          {state.message}
        </p>
      ) : null}
      <fieldset className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
        <legend className="px-1 font-black">{t('shop.checkout.address')}</legend>
        {FIELDS.map((x) => (
          <TextField
            key={x.name}
            label={t(`shop.checkout.${x.name}`)}
            name={x.name}
            id={x.id}
            autoComplete={x.autoComplete}
            inputMode={'inputMode' in x ? x.inputMode : undefined}
            required
            defaultValue={v[x.name]}
            error={f[x.name]}
          />
        ))}
        <label className="flex items-center gap-3 text-[13px] font-bold">
          <input type="checkbox" name="saveAddress" defaultChecked className="h-5 w-5 accent-brand" />
          {t('shop.checkout.saveAddress')}
        </label>
      </fieldset>
      {kiots.map((k) => (
        <TextField
          key={k.id}
          label={t('shop.checkout.note', { name: k.name })}
          name={`note:${k.id}`}
          id={`note-${k.id}`}
          maxLength={500}
        />
      ))}
      <p className="text-[13px] text-white/60">{t('shop.checkout.escrow')}</p>
      <SubmitButton pendingText={t('shop.checkout.placing')}>
        {t('shop.checkout.place', { total: totalText })}
      </SubmitButton>
    </form>
  );
}
