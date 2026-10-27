'use client';

import { useActionState } from 'react';
import { ImagePicker } from '@/app/kiot-cua-toi/san-pham/ImagePicker';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import type { Bank } from '@/modules/kiot/banks';
import { disputeAction, refundAccountAction, type BuyerActionState } from '../actions';

function Feedback({ state, id }: { state: BuyerActionState; id: string }) {
  if (state.error)
    return (
      <p
        role="alert"
        data-testid={`${id}-error`}
        className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
      >
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p
        role="status"
        data-testid={`${id}-ok`}
        className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
      >
        {state.ok}
      </p>
    );
  return null;
}

export function DisputeForm({ orderId }: { orderId: string }) {
  const t = useT();
  const [state, action] = useActionState<BuyerActionState, FormData>(disputeAction.bind(null, orderId), {});
  return (
    <details className="rounded-[18px] border border-white/10 bg-white/5 p-4">
      <summary className="cursor-pointer font-bold text-red-400">{t('shop.dispute.open')}</summary>
      <form action={action} className="mt-3 flex flex-col gap-3">
        <Feedback state={state} id="dispute" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dispute-message" className="text-[12px] font-bold text-white/70">
            {t('shop.dispute.describe')}
          </label>
          <textarea
            id="dispute-message"
            name="message"
            rows={4}
            minLength={10}
            maxLength={2000}
            required
            className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white outline-none focus:border-brand"
          />
        </div>
        <ImagePicker initial={[]} max={3} uploadUrl="/api/orders/dispute-image" kind="plain" />
        <SubmitButton pendingText={t('shop.dispute.sending')}>{t('shop.dispute.send')}</SubmitButton>
      </form>
    </details>
  );
}

export function RefundAccountForm({ orderId, banks }: { orderId: string; banks: readonly Bank[] }) {
  const t = useT();
  const [state, action] = useActionState<BuyerActionState, FormData>(
    refundAccountAction.bind(null, orderId),
    {},
  );
  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-[18px] border border-brand/40 bg-white/5 p-4"
      id="hoan-tien"
    >
      <h2 className="font-black">{t('shop.refund.title')}</h2>
      <Feedback state={state} id="refund" />
      <select
        name="bankBin"
        id="refund-bank"
        required
        defaultValue=""
        className="h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand"
      >
        <option value="" disabled>
          {t('shop.refund.chooseBank')}
        </option>
        {banks.map((b) => (
          <option key={b.bin} value={b.bin}>
            {b.shortName} — {b.name}
          </option>
        ))}
      </select>
      <TextField
        label={t('shop.refund.number')}
        name="accountNumber"
        id="refund-number"
        inputMode="numeric"
        required
      />
      <TextField label={t('shop.refund.name')} name="accountName" id="refund-name" required />
      <SubmitButton pendingText={t('shop.refund.saving')}>{t('shop.refund.save')}</SubmitButton>
    </form>
  );
}
