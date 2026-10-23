'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatVnd } from '@/lib/format';
import { requestPayoutAction, type PayoutRequestState } from '../actions';

// Người bán thấy rõ số tiền sẽ nhận sau phí chi hộ trước khi bấm xác nhận (SPEC-payouts.md mục 4).
export function PayoutRequestForm({ available, fee, min }: { available: number; fee: number; min: number }) {
  const [state, action] = useActionState<PayoutRequestState, FormData>(requestPayoutAction, {});
  const [raw, setRaw] = useState(state.amount ?? String(available));
  const amount = Number(raw.replace(/\D/g, '')) || 0;
  const net = amount - fee;
  const valid = amount >= min && amount <= available && net > 0;
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? (
        <p
          role="alert"
          data-testid="payout-request-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.error}
        </p>
      ) : null}
      <label htmlFor="payout-amount" className="text-sm font-bold">
        Số tiền rút
      </label>
      <input
        id="payout-amount"
        name="amount"
        inputMode="numeric"
        autoComplete="off"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="h-12 rounded-xl border-2 border-black/15 bg-white px-4 text-lg font-bold outline-none focus:border-brand-ink"
      />
      <p className="text-sm text-black/70">
        Tối thiểu {formatVnd(min)} · tối đa {formatVnd(available)}
      </p>
      <p
        className="rounded-xl bg-surface-muted px-4 py-3 font-bold"
        data-testid="payout-quote"
        aria-live="polite"
      >
        {valid
          ? `Bạn sẽ nhận ${formatVnd(net)} (phí ${formatVnd(fee)})`
          : amount > available
            ? 'Số tiền vượt số dư có thể rút.'
            : `Nhập số tiền từ ${formatVnd(min)}.`}
      </p>
      <SubmitButton pendingText="Đang gửi…">Xác nhận rút</SubmitButton>
    </form>
  );
}
