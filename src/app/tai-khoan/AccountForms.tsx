'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { NoPasswordHint } from '@/components/ui/NoPasswordHint';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import {
  changeEmailAction,
  changePasswordAction,
  sendSetPasswordCodeAction,
  setPasswordAction,
  updateProfileAction,
  type FormState,
} from './actions';

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

// Tên hiển thị + giới thiệu (trang Sửa hồ sơ, SPEC-social.md bổ sung 30/10, A2).
export function ProfileForm({ displayName, bio }: { displayName: string; bio: string | null }) {
  const t = useT();
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  const [text, setText] = useState(bio ?? '');
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
        <label className="flex flex-col gap-1.5 text-[12px] font-bold text-white/70" htmlFor="profile-bio">
          {t('profile.edit.bio', { count: [...text].length, max: 160 })}
          <textarea
            id="profile-bio"
            name="bio"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('profile.edit.bioPlaceholder')}
            className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-[14px] font-normal text-white outline-none placeholder:text-white/40 focus:border-brand"
          />
          <span className="font-normal text-white/50">{t('profile.edit.bioHint')}</span>
        </label>
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
        <NoPasswordHint />
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
        <NoPasswordHint />
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

// Đặt mật khẩu mới bằng mã gửi về email của tài khoản (không cần mật khẩu cũ) — CEO chốt 29/10.
export function SetPasswordForm({ email }: { email: string | null }) {
  const t = useT();
  const [sent, setSent] = useState<FormState | null>(null);
  const [sending, startSending] = useTransition();
  const [state, action] = useActionState<FormState, FormData>(setPasswordAction, {});
  return (
    <Card title={t('me.settings.setPassword')} id="dat-mat-khau">
      {email ? (
        <>
          <p className="text-[13px] text-white/60">{t('me.settings.setPasswordLead', { email })}</p>
          {sent ? <Feedback state={sent} id="set-password-code" /> : null}
          <button
            type="button"
            disabled={sending}
            onClick={() => startSending(async () => setSent(await sendSetPasswordCodeAction()))}
            className="h-11 rounded-full bg-white/10 text-[14px] font-black disabled:opacity-60"
            data-testid="set-password-send"
          >
            {t('me.settings.sendCode')}
          </button>
          <form action={action} className="flex flex-col gap-4">
            <Feedback state={state} id="set-password" />
            <TextField
              tone="dark"
              label={t('me.settings.code')}
              name="code"
              id="setpw-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
            <TextField
              tone="dark"
              label={t('me.settings.newPassword')}
              hint={t('me.settings.newPasswordHint')}
              name="newPassword"
              id="setpw-new"
              type="password"
              autoComplete="new-password"
              required
            />
            <TextField
              tone="dark"
              label={t('me.settings.confirm')}
              name="confirm"
              id="setpw-confirm"
              type="password"
              autoComplete="new-password"
              required
            />
            <SubmitButton tone="v4" pendingText={t('me.settings.saving')} testId="set-password-save">
              {t('me.settings.setPasswordSave')}
            </SubmitButton>
          </form>
        </>
      ) : (
        <p className="text-[13px] text-white/60">{t('me.settings.setPasswordNoEmail')}</p>
      )}
    </Card>
  );
}
