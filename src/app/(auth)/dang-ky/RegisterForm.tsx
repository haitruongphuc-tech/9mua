'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField, type FieldTone } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { registerAction, type RegisterFormState } from './actions';

// Dùng ở trang /dang-ky (nền đen) và trong popup mở tài khoản (nền trắng).
export function RegisterForm({
  next,
  tone = 'dark',
  submitLabel,
  showLogin = true,
}: {
  next: string;
  tone?: Exclude<FieldTone, 'light'>;
  submitLabel?: string;
  showLogin?: boolean;
}) {
  const t = useT();
  const [state, action] = useActionState<RegisterFormState, FormData>(registerAction, {});
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="next" value={next} />
      <TextField
        tone={tone}
        label={t('auth.displayName')}
        name="displayName"
        autoComplete="name"
        required
        defaultValue={state.values?.displayName}
        error={state.fields?.displayName}
      />
      <TextField
        tone={tone}
        label={t('auth.identifier')}
        name="identifier"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={state.values?.identifier}
        error={state.fields?.identifier}
      />
      <TextField
        tone={tone}
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={t('auth.passwordHint')}
        error={state.fields?.password}
      />
      <SubmitButton tone="v4" pendingText={t('auth.register.pending')}>
        {submitLabel ?? t('auth.register.submit')}
      </SubmitButton>
      {showLogin ? (
        <p className={`text-center text-[13px] ${tone === 'dark' ? 'text-white/60' : 'text-zinc-500'}`}>
          {t('auth.register.haveAccount')}{' '}
          <Link href={`/dang-nhap?next=${encodeURIComponent(next)}`} className="font-bold text-brand">
            {t('auth.login.submit')}
          </Link>
        </p>
      ) : null}
    </form>
  );
}
