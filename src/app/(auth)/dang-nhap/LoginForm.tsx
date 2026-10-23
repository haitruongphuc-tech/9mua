'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { loginAction, type LoginFormState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginFormState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {state.message ? (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.message}
        </p>
      ) : null}
      <TextField
        label="Số điện thoại hoặc email"
        name="identifier"
        autoComplete="username"
        required
        defaultValue={state.identifier}
      />
      <TextField label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton pendingText="Đang đăng nhập…">Đăng nhập</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/quen-mat-khau" className="font-bold text-brand-deep underline">
          Quên mật khẩu?
        </Link>
        <Link
          href={`/dang-ky?next=${encodeURIComponent(next)}`}
          className="font-bold text-brand-deep underline"
        >
          Tạo tài khoản
        </Link>
      </div>
    </form>
  );
}
