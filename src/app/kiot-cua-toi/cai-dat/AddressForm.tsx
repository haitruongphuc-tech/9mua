'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { PROVINCES } from '@/modules/kiot/provinces';
import { updateAddressAction, type AddressFormState, type AddressValues } from './address-actions';

export function AddressForm({ initial }: { initial: AddressValues }) {
  const t = useT();
  const [state, action] = useActionState<AddressFormState, FormData>(updateAddressAction, {
    values: initial,
  });
  const v = state.values ?? initial;
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-[13px] text-white/60">{t('seller.addr.note')}</p>
      {state.ok ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {state.ok}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kiot-province" className="text-[12px] font-bold text-white/70">
          {t('seller.addr.province')}
        </label>
        <select
          id="kiot-province"
          name="province"
          key={v.province || 'province'}
          defaultValue={v.province}
          required
          className="h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand"
        >
          <option value="" disabled>
            {t('seller.addr.chooseProvince')}
          </option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        {state.fields?.province ? <p className="text-[12px] text-red-400">{state.fields.province}</p> : null}
      </div>
      <TextField
        label={t('seller.addr.district')}
        name="district"
        id="kiot-district"
        defaultValue={v.district}
        error={state.fields?.district}
      />
      <TextField
        label={t('seller.addr.line')}
        name="addressLine"
        id="kiot-address"
        defaultValue={v.addressLine}
        error={state.fields?.addressLine}
      />
      <SubmitButton pendingText={t('seller.form.saving')}>{t('seller.addr.save')}</SubmitButton>
    </form>
  );
}
