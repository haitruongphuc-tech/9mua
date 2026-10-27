'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import type { Bank } from '@/modules/kiot/banks';
import { setPayoutAccountAction, type PayoutFormState } from './payout-actions';

type Current = { bankName: string; accountNumber: string; accountName: string } | null;

export function PayoutAccountForm({ banks, current }: { banks: readonly Bank[]; current: Current }) {
  const t = useT();
  const [state, action] = useActionState<PayoutFormState, FormData>(setPayoutAccountAction, {});
  const v = state.values;
  return (
    <form action={action} className="flex flex-col gap-4" id="tai-khoan-nhan-tien">
      <p className="text-[13px] text-white/60" data-testid="payout-current">
        {current
          ? t('seller.payacc.current', {
              bank: current.bankName,
              number: current.accountNumber,
              name: current.accountName,
            })
          : t('seller.payacc.none')}
      </p>
      {state.error ? (
        <p
          role="alert"
          data-testid="payout-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          data-testid="payout-ok"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {state.ok}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bank-bin" className="text-[12px] font-bold text-white/70">
          {t('seller.payacc.bank')}
        </label>
        <select
          id="bank-bin"
          name="bankBin"
          key={v?.bankBin ?? 'bank'}
          defaultValue={v?.bankBin ?? ''}
          required
          className="h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand"
        >
          <option value="" disabled>
            {t('seller.payacc.chooseBank')}
          </option>
          {banks.map((b) => (
            <option key={b.bin} value={b.bin}>
              {b.shortName} — {b.name}
            </option>
          ))}
        </select>
        {state.fields?.bankBin ? <p className="text-[12px] text-red-400">{state.fields.bankBin}</p> : null}
      </div>
      <TextField
        label={t('seller.payacc.number')}
        name="accountNumber"
        id="bank-account"
        inputMode="numeric"
        required
        defaultValue={v?.accountNumber}
        error={state.fields?.accountNumber}
      />
      <TextField
        label={t('seller.payacc.name')}
        name="accountName"
        id="bank-name"
        required
        hint={t('seller.payacc.nameHint')}
        defaultValue={v?.accountName}
        error={state.fields?.accountName}
      />
      <TextField
        label={t('seller.payacc.password')}
        name="password"
        id="bank-password"
        type="password"
        autoComplete="current-password"
        required
      />
      <SubmitButton pendingText={t('seller.form.saving')}>{t('seller.payacc.save')}</SubmitButton>
    </form>
  );
}
