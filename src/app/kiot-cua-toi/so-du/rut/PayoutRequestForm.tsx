'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import { requestPayoutAction, type PayoutRequestState } from '../actions';

// Người bán thấy rõ số tiền sẽ nhận sau phí chi hộ trước khi bấm xác nhận (SPEC-payouts.md mục 4).
export function PayoutRequestForm({ available, fee, min }: { available: number; fee: number; min: number }) {
  const t = useT();
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
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {state.error}
        </p>
      ) : null}
      <label htmlFor="payout-amount" className="text-[12px] font-bold text-white/70">
        {t('seller.wd.amount')}
      </label>
      <input
        id="payout-amount"
        name="amount"
        inputMode="numeric"
        autoComplete="off"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        className="h-12 rounded-full border border-white/15 bg-white/10 px-5 text-lg font-black text-white outline-none focus:border-brand"
      />
      <p className="text-[13px] text-white/60">
        {t('seller.wd.range', { min: formatVnd(min), max: formatVnd(available) })}
      </p>
      <p
        className="rounded-[14px] bg-white/5 px-4 py-3 font-bold"
        data-testid="payout-quote"
        aria-live="polite"
      >
        {valid
          ? t('seller.wd.receive', { net: formatVnd(net), fee: formatVnd(fee) })
          : amount > available
            ? t('seller.wd.over')
            : t('seller.wd.enter', { min: formatVnd(min) })}
      </p>
      <SubmitButton pendingText={t('seller.wd.sending')}>{t('seller.wd.confirm')}</SubmitButton>
    </form>
  );
}
