'use client';

import { useActionState } from 'react';
import { ImagePicker } from '@/app/kiot-cua-toi/san-pham/ImagePicker';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import type { Bank } from '@/modules/kiot/banks';
import { disputeAction, refundAccountAction, type BuyerActionState } from '../actions';

function Feedback({ state, id }: { state: BuyerActionState; id: string }) {
  if (state.error)
    return (
      <p
        role="alert"
        data-testid={`${id}-error`}
        className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
      >
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p
        role="status"
        data-testid={`${id}-ok`}
        className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success"
      >
        {state.ok}
      </p>
    );
  return null;
}

export function DisputeForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<BuyerActionState, FormData>(disputeAction.bind(null, orderId), {});
  return (
    <details className="rounded-2xl border-2 border-black/10 p-4">
      <summary className="cursor-pointer font-bold text-danger">Báo vấn đề với đơn hàng</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <Feedback state={state} id="dispute" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dispute-message" className="text-sm font-bold">
            Mô tả vấn đề
          </label>
          <textarea
            id="dispute-message"
            name="message"
            rows={4}
            minLength={10}
            maxLength={2000}
            required
            className="rounded-xl border-2 border-black/15 px-4 py-3"
          />
        </div>
        <ImagePicker initial={[]} max={3} uploadUrl="/api/orders/dispute-image" />
        <SubmitButton pendingText="Đang gửi…">Gửi khiếu nại</SubmitButton>
      </form>
    </details>
  );
}

export function RefundAccountForm({ orderId, banks }: { orderId: string; banks: readonly Bank[] }) {
  const [state, action] = useActionState<BuyerActionState, FormData>(
    refundAccountAction.bind(null, orderId),
    {},
  );
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-2xl border-2 border-brand-ink p-4"
      id="hoan-tien"
    >
      <h2 className="font-extrabold">Tài khoản nhận hoàn tiền</h2>
      <Feedback state={state} id="refund" />
      <select
        name="bankBin"
        id="refund-bank"
        required
        defaultValue=""
        className="h-12 rounded-xl border-2 border-black/15 bg-white px-3"
      >
        <option value="" disabled>
          Chọn ngân hàng…
        </option>
        {banks.map((b) => (
          <option key={b.bin} value={b.bin}>
            {b.shortName} — {b.name}
          </option>
        ))}
      </select>
      <TextField label="Số tài khoản" name="accountNumber" id="refund-number" inputMode="numeric" required />
      <TextField label="Tên chủ tài khoản" name="accountName" id="refund-name" required />
      <SubmitButton pendingText="Đang lưu…">Lưu tài khoản</SubmitButton>
    </form>
  );
}
