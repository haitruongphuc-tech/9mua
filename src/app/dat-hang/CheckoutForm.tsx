'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { placeOrderAction, type CheckoutFormState } from './actions';

type Saved = {
  name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  line: string;
} | null;

export function CheckoutForm({
  saved,
  kiots,
  totalText,
}: {
  saved: Saved;
  kiots: { id: string; name: string }[];
  totalText: string;
}) {
  const [state, action] = useActionState<CheckoutFormState, FormData>(placeOrderAction, {});
  const v = state.values ?? (saved ? { ...saved, phone: '0' + saved.phone.replace(/^\+84/, '') } : {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
          {state.message}
        </p>
      ) : null}
      <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-black/10 p-4">
        <legend className="px-1 font-extrabold">Địa chỉ nhận hàng</legend>
        <TextField
          label="Họ tên người nhận"
          name="name"
          id="a-name"
          autoComplete="name"
          required
          defaultValue={v.name}
          error={f.name}
        />
        <TextField
          label="Số điện thoại"
          name="phone"
          id="a-phone"
          autoComplete="tel"
          inputMode="tel"
          required
          defaultValue={v.phone}
          error={f.phone}
        />
        <TextField
          label="Tỉnh / Thành phố"
          name="province"
          id="a-province"
          autoComplete="address-level1"
          required
          defaultValue={v.province}
          error={f.province}
        />
        <TextField
          label="Quận / Huyện"
          name="district"
          id="a-district"
          autoComplete="address-level2"
          required
          defaultValue={v.district}
          error={f.district}
        />
        <TextField
          label="Phường / Xã"
          name="ward"
          id="a-ward"
          autoComplete="address-level3"
          required
          defaultValue={v.ward}
          error={f.ward}
        />
        <TextField
          label="Số nhà, tên đường"
          name="line"
          id="a-line"
          autoComplete="street-address"
          required
          defaultValue={v.line}
          error={f.line}
        />
        <label className="flex items-center gap-3 text-sm font-bold">
          <input type="checkbox" name="saveAddress" defaultChecked className="h-5 w-5 accent-brand" />
          Lưu làm địa chỉ mặc định
        </label>
      </fieldset>
      {kiots.map((k) => (
        <TextField
          key={k.id}
          label={`Ghi chú cho ${k.name} (tuỳ chọn)`}
          name={`note:${k.id}`}
          id={`note-${k.id}`}
          maxLength={500}
        />
      ))}
      <p className="text-sm text-black/70">
        Bạn thanh toán cho <strong>9MUA</strong> qua QR. 9MUA giữ tiền và chỉ chuyển cho người bán sau khi bạn
        nhận hàng và hết 7 ngày khiếu nại.
      </p>
      <SubmitButton pendingText="Đang tạo đơn…">Đặt hàng và thanh toán {totalText}</SubmitButton>
    </form>
  );
}
