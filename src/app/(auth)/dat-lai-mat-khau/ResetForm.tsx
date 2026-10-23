'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { resetPasswordAction, type ResetFormState } from './actions';

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<ResetFormState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.error}{' '}
          <Link href="/quen-mat-khau" className="underline">
            Gửi lại link
          </Link>
        </p>
      ) : null}
      <TextField
        label="Mật khẩu mới"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Ít nhất 8 ký tự"
      />
      <TextField
        label="Nhập lại mật khẩu mới"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton pendingText="Đang lưu…">Đặt mật khẩu mới</SubmitButton>
    </form>
  );
}
