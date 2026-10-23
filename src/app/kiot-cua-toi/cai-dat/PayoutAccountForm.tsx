'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import type { Bank } from '@/modules/kiot/banks';
import { setPayoutAccountAction, type PayoutFormState } from './payout-actions';

type Current = { bankName: string; accountNumber: string; accountName: string } | null;

export function PayoutAccountForm({ banks, current }: { banks: readonly Bank[]; current: Current }) {
  const [state, action] = useActionState<PayoutFormState, FormData>(setPayoutAccountAction, {});
  const v = state.values;
  return (
    <form action={action} className="flex flex-col gap-4" id="tai-khoan-nhan-tien">
      <p className="text-sm text-black/70" data-testid="payout-current">
        {current
          ? `Đang dùng: ${current.bankName} · ${current.accountNumber} · ${current.accountName}`
          : 'Chưa có tài khoản nhận tiền. 9MUA chuyển tiền bán hàng vào tài khoản này.'}
      </p>
      {state.error ? (
        <p
          role="alert"
          data-testid="payout-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          data-testid="payout-ok"
          className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success"
        >
          {state.ok}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bank-bin" className="text-sm font-bold">
          Ngân hàng
        </label>
        <select
          id="bank-bin"
          name="bankBin"
          key={v?.bankBin ?? 'bank'}
          defaultValue={v?.bankBin ?? ''}
          required
          className="h-12 rounded-xl border-2 border-black/15 bg-white px-3 text-base outline-none focus:border-brand-ink"
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
        {state.fields?.bankBin ? <p className="text-sm text-danger">{state.fields.bankBin}</p> : null}
      </div>
      <TextField
        label="Số tài khoản"
        name="accountNumber"
        id="bank-account"
        inputMode="numeric"
        required
        defaultValue={v?.accountNumber}
        error={state.fields?.accountNumber}
      />
      <TextField
        label="Tên chủ tài khoản"
        name="accountName"
        id="bank-name"
        required
        hint="Đúng như trên ngân hàng; hệ thống tự viết hoa, bỏ dấu."
        defaultValue={v?.accountName}
        error={state.fields?.accountName}
      />
      <TextField
        label="Mật khẩu đăng nhập (để xác nhận)"
        name="password"
        id="bank-password"
        type="password"
        autoComplete="current-password"
        required
      />
      <SubmitButton pendingText="Đang lưu…">Lưu tài khoản nhận tiền</SubmitButton>
    </form>
  );
}
