'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { updateShippingAction, type ShippingFormState } from './shipping-actions';

export function ShippingForm({
  shippingFee,
  freeShippingThreshold,
}: {
  shippingFee: number;
  freeShippingThreshold: number | null;
}) {
  const [state, action] = useActionState<ShippingFormState, FormData>(updateShippingAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" id="phi-ship">
      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          data-testid="shipping-ok"
          className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success"
        >
          {state.ok}
        </p>
      ) : null}
      <TextField
        label="Phí ship mỗi đơn (đ)"
        name="shippingFee"
        id="ship-fee"
        inputMode="numeric"
        defaultValue={shippingFee}
        hint="0 = miễn phí ship; tối đa 200.000đ"
      />
      <TextField
        label="Miễn phí ship khi tiền hàng từ (đ, tuỳ chọn)"
        name="freeShippingThreshold"
        id="ship-free"
        inputMode="numeric"
        defaultValue={freeShippingThreshold ?? ''}
      />
      <SubmitButton pendingText="Đang lưu…">Lưu phí ship</SubmitButton>
    </form>
  );
}
