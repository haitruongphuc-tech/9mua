'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { updateShippingAction, type ShippingFormState } from './shipping-actions';

export function ShippingForm({
  shippingFee,
  freeShippingThreshold,
}: {
  shippingFee: number;
  freeShippingThreshold: number | null;
}) {
  const t = useT();
  const [state, action] = useActionState<ShippingFormState, FormData>(updateShippingAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" id="phi-ship">
      {state.error ? (
        <p role="alert" className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          data-testid="shipping-ok"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {state.ok}
        </p>
      ) : null}
      <TextField
        label={t('seller.ship.fee')}
        name="shippingFee"
        id="ship-fee"
        inputMode="numeric"
        defaultValue={shippingFee}
        hint={t('seller.ship.feeHint')}
      />
      <TextField
        label={t('seller.ship.free')}
        name="freeShippingThreshold"
        id="ship-free"
        inputMode="numeric"
        defaultValue={freeShippingThreshold ?? ''}
      />
      <SubmitButton pendingText={t('seller.form.saving')}>{t('seller.ship.save')}</SubmitButton>
    </form>
  );
}
