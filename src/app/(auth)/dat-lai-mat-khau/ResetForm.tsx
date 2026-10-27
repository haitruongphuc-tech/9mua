'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { resetPasswordAction, type ResetFormState } from './actions';

export function ResetForm({ token }: { token: string }) {
  const t = useT();
  const [state, action] = useActionState<ResetFormState, FormData>(resetPasswordAction, {});
  useEffect(() => {
    // Mật khẩu đã đổi, mọi phiên đã bị xoá: tải hẳn trang đăng nhập.
    if (state.done) window.location.assign('/dang-nhap?da-dat-lai=1');
  }, [state.done]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {state.error}{' '}
          <Link href="/quen-mat-khau" className="underline">
            {t('auth.reset.resend')}
          </Link>
        </p>
      ) : null}
      <TextField
        tone="dark"
        label={t('auth.reset.new')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t('auth.passwordHint')}
      />
      <TextField
        tone="dark"
        label={t('auth.reset.confirm')}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton tone="v4" pendingText={t('auth.reset.pending')}>
        {t('auth.reset.submit')}
      </SubmitButton>
    </form>
  );
}
