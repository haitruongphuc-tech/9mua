'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { confirmSetupAction, verifyTotpAction, type TotpState } from './actions';

const field =
  'h-14 rounded-xl border-2 border-black/15 bg-white px-4 text-center text-2xl font-extrabold tracking-[0.3em] outline-none focus:border-brand-ink';

export function VerifyForm({ next }: { next: string }) {
  const [state, action] = useActionState<TotpState, FormData>(verifyTotpAction.bind(null, next), {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? (
        <p
          role="alert"
          data-testid="totp-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.error}
        </p>
      ) : null}
      <input
        name="code"
        id="totp-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        required
        aria-label="Mã 6 số"
        className={field}
      />
      <label className="flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" name="remember" defaultChecked className="h-5 w-5 accent-brand" />
        Nhớ thiết bị này 30 ngày
      </label>
      <SubmitButton pendingText="Đang kiểm tra…">Xác nhận</SubmitButton>
      <p className="text-center text-xs text-black/60">
        Mất điện thoại? Nhập một mã dự phòng (dạng ABCDE-12345).
      </p>
    </form>
  );
}

export function ConfirmSetupForm() {
  const [state, action] = useActionState<TotpState, FormData>(confirmSetupAction, {});
  if (state.backupCodes)
    return (
      <div className="flex flex-col gap-3" data-testid="backup-codes">
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã bật xác thực 2 lớp. Chép 10 mã dự phòng dưới đây và cất nơi an toàn — mỗi mã dùng được 1 lần khi
          mất điện thoại. Mã chỉ hiện một lần này.
        </p>
        <ol className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-4 font-mono text-sm font-bold">
          {state.backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <Link
          href="/admin"
          className="rounded-full border-2 border-brand-ink bg-brand py-3 text-center font-extrabold text-brand-ink"
        >
          Tôi đã lưu mã, vào trang CEO
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error ? (
        <p
          role="alert"
          data-testid="totp-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.error}
        </p>
      ) : null}
      <input
        name="code"
        id="totp-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        aria-label="Mã 6 số"
        className={field}
      />
      <SubmitButton pendingText="Đang kiểm tra…">Bật xác thực 2 lớp</SubmitButton>
    </form>
  );
}
