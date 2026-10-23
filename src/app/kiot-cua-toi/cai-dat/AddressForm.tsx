'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { PROVINCES } from '@/modules/kiot/provinces';
import { updateAddressAction, type AddressFormState, type AddressValues } from './address-actions';

export function AddressForm({ initial }: { initial: AddressValues }) {
  const [state, action] = useActionState<AddressFormState, FormData>(updateAddressAction, {
    values: initial,
  });
  const v = state.values ?? initial;
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-black/70">
        Người mua thấy tỉnh và quận/huyện của Kiot trên Chợ. Địa chỉ chi tiết chỉ dùng khi gửi hàng, không
        hiện công khai.
      </p>
      {state.ok ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          {state.ok}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kiot-province" className="text-sm font-bold">
          Tỉnh/thành
        </label>
        <select
          id="kiot-province"
          name="province"
          key={v.province || 'province'}
          defaultValue={v.province}
          required
          className="h-12 rounded-xl border-2 border-black/15 bg-white px-3 text-base outline-none focus:border-brand-ink"
        >
          <option value="" disabled>
            Chọn tỉnh/thành…
          </option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        {state.fields?.province ? <p className="text-sm text-danger">{state.fields.province}</p> : null}
      </div>
      <TextField
        label="Quận/huyện, phường/xã"
        name="district"
        id="kiot-district"
        defaultValue={v.district}
        error={state.fields?.district}
      />
      <TextField
        label="Địa chỉ lấy hàng chi tiết"
        name="addressLine"
        id="kiot-address"
        defaultValue={v.addressLine}
        error={state.fields?.addressLine}
      />
      <SubmitButton pendingText="Đang lưu…">Lưu địa chỉ</SubmitButton>
    </form>
  );
}
