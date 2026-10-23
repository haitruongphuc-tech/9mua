'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { forgotPasswordAction, type ForgotFormState } from './actions';

export function ForgotForm() {
  const [state, action] = useActionState<ForgotFormState, FormData>(forgotPasswordAction, {});
  if (state.sent) {
    return (
      <div role="status" className="rounded-xl bg-success/10 p-4 text-sm" data-testid="forgot-sent">
        Nếu email <strong>{state.email}</strong> đã đăng ký, chúng tôi đã gửi link đặt lại mật khẩu. Link có
        hiệu lực 30 phút. Hãy kiểm tra cả hộp thư Spam.
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField label="Email đã đăng ký" name="email" type="email" autoComplete="email" required />
      <SubmitButton pendingText="Đang gửi…">Gửi link đặt lại</SubmitButton>
      <p className="text-sm text-black/70">
        Bạn đăng ký bằng số điện thoại và chưa thêm email? Hãy liên hệ 9MUA để được cấp lại mật khẩu.{' '}
        <Link href="/dang-nhap" className="font-bold text-brand-deep underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </form>
  );
}
