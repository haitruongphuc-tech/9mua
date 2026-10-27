'use client';

import type { OrderStatus } from '@prisma/client';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { sellerOrderAction, type SellerActionState } from '../actions';

const danger = 'h-12 rounded-full border border-red-500 font-black text-red-400';
const box = 'rounded-[18px] border border-white/10 bg-white/5 p-3';

export function SellerActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const t = useT();
  const [state, action] = useActionState<SellerActionState, FormData>(
    sellerOrderAction.bind(null, orderId),
    {},
  );
  const error = state.error ? (
    <p
      role="alert"
      data-testid="seller-action-error"
      className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
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
          <SubmitButton pendingText={t('seller.act.confirming')}>{t('seller.act.confirm')}</SubmitButton>
        </form>
        <details className={box}>
          <summary className="cursor-pointer font-bold text-red-400">{t('seller.act.rejectOpen')}</summary>
          <form action={action} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="action" value="reject" />
            <TextField label={t('seller.act.reason')} name="reason" id="reject-reason" required />
            <button className={danger}>{t('seller.act.reject')}</button>
          </form>
        </details>
      </div>
    );
  }
  if (status === 'confirmed') {
    return (
      <div className="flex flex-col gap-3">
        {error}
        <form action={action} className={`flex flex-col gap-2 ${box}`}>
          <input type="hidden" name="action" value="ship" />
          <TextField label={t('seller.act.tracking')} name="trackingCode" id="ship-tracking" maxLength={60} />
          <TextField label={t('seller.act.carrier')} name="carrier" id="ship-carrier" maxLength={60} />
          <SubmitButton pendingText={t('seller.act.updating')}>{t('seller.act.shipped')}</SubmitButton>
        </form>
        <details className={box}>
          <summary className="cursor-pointer font-bold text-red-400">{t('seller.act.cancelOpen')}</summary>
          <form action={action} className="mt-3 flex flex-col gap-2">
            <input type="hidden" name="action" value="seller_cancel" />
            <TextField label={t('seller.act.reason')} name="reason" id="cancel-reason" required />
            <button className={danger}>{t('seller.act.cancel')}</button>
          </form>
        </details>
      </div>
    );
  }
  return error;
}
