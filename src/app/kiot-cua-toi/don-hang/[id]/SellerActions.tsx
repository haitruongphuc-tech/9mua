'use client';

import type { OrderStatus } from '@prisma/client';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { sellerOrderAction, type SellerActionState } from '../actions';

export function SellerActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, action] = useActionState<SellerActionState, FormData>(
    sellerOrderAction.bind(null, orderId),
    {},
  );
  const error = state.error ? (
    <p
      role="alert"
      data-testid="seller-action-error"
      className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
    >
      {state.error}
    </p>
  ) : null;

  if (status === 'paid') {
    return (
      <div className="flex flex-col gap-3">
        {error}
        <form action={action}>
          <input type="hidden" name="action" value="confirm" />
          <SubmitButton pendingText="Đang xác nhận…">Xác nhận đơn</SubmitButton>
        </form>
        <details className="rounded-2xl border-2 border-black/10 p-3">
          <summary className="cursor-pointer font-bold text-danger">
            Từ chối đơn (hoàn tiền cho khách)
          </summary>
          <form action={action} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="action" value="reject" />
            <TextField label="Lý do" name="reason" id="reject-reason" required />
            <button className="h-12 rounded-full border-2 border-danger font-extrabold text-danger">
              Từ chối đơn
            </button>
          </form>
        </details>
      </div>
    );
  }
  if (status === 'confirmed') {
    return (
      <div className="flex flex-col gap-3">
        {error}
        <form action={action} className="flex flex-col gap-2 rounded-2xl border-2 border-brand-ink p-3">
          <input type="hidden" name="action" value="ship" />
          <TextField label="Mã vận đơn (tuỳ chọn)" name="trackingCode" id="ship-tracking" maxLength={60} />
          <TextField label="Hãng vận chuyển (tuỳ chọn)" name="carrier" id="ship-carrier" maxLength={60} />
          <SubmitButton pendingText="Đang cập nhật…">Đã giao cho shipper</SubmitButton>
        </form>
        <details className="rounded-2xl border-2 border-black/10 p-3">
          <summary className="cursor-pointer font-bold text-danger">Huỷ đơn (hoàn tiền cho khách)</summary>
          <form action={action} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="action" value="seller_cancel" />
            <TextField label="Lý do" name="reason" id="cancel-reason" required />
            <button className="h-12 rounded-full border-2 border-danger font-extrabold text-danger">
              Huỷ đơn
            </button>
          </form>
        </details>
      </div>
    );
  }
  return error;
}
