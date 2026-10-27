'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { loginAction, type LoginFormState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const t = useT();
  const [state, action] = useActionState<LoginFormState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {state.message ? (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {state.message}
        </p>
      ) : null}
      <TextField
        tone="dark"
        label={t('auth.identifier')}
        name="identifier"
        autoComplete="username"
        required
        defaultValue={state.identifier}
      />
      <TextField
        tone="dark"
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <SubmitButton tone="v4" pendingText={t('auth.login.pending')}>
        {t('auth.login.submit')}
      </SubmitButton>
      <div className="flex justify-between text-[13px]">
        <Link href="/quen-mat-khau" className="font-bold text-brand">
          {t('auth.login.forgot')}
        </Link>
        <Link href={`/dang-ky?next=${encodeURIComponent(next)}`} className="font-bold text-brand">
          {t('auth.login.create')}
        </Link>
      </div>
    </form>
  );
}
