'use client';

import { useActionState, useEffect } from 'react';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { changeEmailAction, changePasswordAction, updateProfileAction, type FormState } from './actions';

function Feedback({ state, id }: { state: FormState; id: string }) {
  if (state.error)
    return (
      <p
        role="alert"
        data-testid={`${id}-error`}
        className="rounded-[14px] bg-danger/15 px-4 py-3 text-[13px] font-bold text-danger"
      >
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p
        role="status"
        data-testid={`${id}-ok`}
        className="rounded-[14px] bg-success/15 px-4 py-3 text-[13px] font-bold text-success"
      >
        {state.ok}
      </p>
    );
  return null;
}

// Thẻ V4 trên nền đen: viền trắng mờ 1px, bo 18px (docs/BRAND.md).
export function Card({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-[18px] border border-white/10 bg-white/5 p-5">
      <h2 className="font-display text-[16px] font-black">{title}</h2>
      {children}
    </section>
  );
}

export function ProfileForm({ displayName }: { displayName: string }) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
  }, [state]);
  return (
    <Card title={t('me.settings.info')} id="thong-tin">
      <form action={action} className="flex flex-col gap-4">
        <Feedback state={state} id="profile" />
        <TextField
          tone="dark"
          label={t('me.settings.displayName')}
          name="displayName"
          id="profile-name"
          defaultValue={displayName}
          required
        />
        <SubmitButton tone="v4" pendingText={t('me.settings.saving')}>
          {t('me.settings.save')}
        </SubmitButton>
      </form>
    </Card>
  );
}

export function EmailForm({ email }: { email: string | null }) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(changeEmailAction, {});
  return (
    <Card title={email ? t('me.settings.email') : t('me.settings.addEmail')} id="email">
      <p className="text-[13px] text-white/60">
        {email ? t('me.settings.currentEmail', { email }) : t('me.settings.addEmailHint')}
      </p>
      <form action={action} className="flex flex-col gap-4">
        <Feedback state={state} id="email" />
        <TextField
          tone="dark"
          label={t('me.settings.email')}
          name="email"
          id="email-new"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          key={state.email ?? 'email'}
        />
        <TextField
          tone="dark"
          label={t('me.settings.currentPassword')}
          name="password"
          id="email-password"
          type="password"
          autoComplete="current-password"
          required
        />
        <SubmitButton tone="v4" pendingText={t('me.settings.saving')}>
          {t('me.settings.saveEmail')}
        </SubmitButton>
      </form>
    </Card>
  );
}

export function PasswordForm({ forced }: { forced: boolean }) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <Card title={t('me.settings.password')} id="doi-mat-khau">
      {forced && !state.ok ? (
        <p role="alert" className="rounded-[14px] bg-brand/20 px-4 py-3 text-[13px] font-bold">
          {t('me.settings.forced')}
        </p>
      ) : null}
      <form action={action} className="flex flex-col gap-4">
        <Feedback state={state} id="password" />
        <TextField
          tone="dark"
          label={t('me.settings.currentPassword')}
          name="oldPassword"
          id="pw-old"
          type="password"
          autoComplete="current-password"
          required
        />
        <TextField
          tone="dark"
          label={t('me.settings.newPassword')}
          name="newPassword"
          id="pw-new"
          type="password"
          autoComplete="new-password"
          required
          hint={t('me.settings.newPasswordHint')}
        />
        <TextField
          tone="dark"
          label={t('me.settings.confirm')}
          name="confirm"
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton tone="v4" pendingText={t('me.settings.changing')}>
          {t('me.settings.password')}
        </SubmitButton>
      </form>
    </Card>
  );
}
