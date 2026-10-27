'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { forgotPasswordAction, type ForgotFormState } from './actions';

export function ForgotForm() {
  const t = useT();
  const [state, action] = useActionState<ForgotFormState, FormData>(forgotPasswordAction, {});
  if (state.sent) {
    return (
      <div
        role="status"
        className="rounded-[14px] bg-success/20 p-4 text-[13px] text-emerald-200"
        data-testid="forgot-sent"
      >
        {t('auth.forgot.sent', { email: state.email ?? '' })}
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        tone="dark"
        label={t('auth.forgot.email')}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <SubmitButton tone="v4" pendingText={t('auth.forgot.pending')}>
        {t('auth.forgot.submit')}
      </SubmitButton>
      <p className="text-[13px] text-white/60">
        {t('auth.forgot.phoneOnly')}{' '}
        <Link href="/dang-nhap" className="font-bold text-brand">
          {t('auth.forgot.back')}
        </Link>
      </p>
    </form>
  );
}
