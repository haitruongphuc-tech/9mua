'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { registerAction, type RegisterFormState } from './actions';

export function RegisterForm({ next }: { next: string }) {
  const [state, action] = useActionState<RegisterFormState, FormData>(registerAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <TextField
        label="Số điện thoại hoặc email"
        name="identifier"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={state.values?.identifier}
        error={state.fields?.identifier}
      />
      <TextField
        label="Tên hiển thị"
        name="displayName"
        autoComplete="name"
        required
        defaultValue={state.values?.displayName}
        error={state.fields?.displayName}
      />
      <TextField
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Ít nhất 8 ký tự"
        error={state.fields?.password}
      />
      <SubmitButton pendingText="Đang tạo tài khoản…">Đăng ký</SubmitButton>
      <p className="text-center text-sm">
        Đã có tài khoản?{' '}
        <Link
          href={`/dang-nhap?next=${encodeURIComponent(next)}`}
          className="font-bold text-brand-deep underline"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
