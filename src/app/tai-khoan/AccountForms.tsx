'use client';

import { useActionState, useEffect } from 'react';
import { ME_CHANGED_EVENT } from '@/components/UserMenu';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { changeEmailAction, changePasswordAction, updateProfileAction, type FormState } from './actions';

function Feedback({ state, id }: { state: FormState; id: string }) {
  if (state.error)
    return (
      <p
        role="alert"
        data-testid={`${id}-error`}
        className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
      >
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p
        role="status"
        data-testid={`${id}-ok`}
        className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success"
      >
        {state.ok}
      </p>
    );
  return null;
}

function Card({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-2xl border-2 border-black/10 p-5">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  useEffect(() => {
    if (state.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
  }, [state]);
  return (
    <Card title="Thông tin" id="thong-tin">
      <form action={action} className="flex flex-col gap-4">
        <Feedback state={state} id="profile" />
        <TextField
          label="Tên hiển thị"
          name="displayName"
          id="profile-name"
          defaultValue={displayName}
          required
        />
        <SubmitButton pendingText="Đang lưu…">Lưu</SubmitButton>
      </form>
    </Card>
  );
}

export function EmailForm({ email }: { email: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(changeEmailAction, {});
  return (
    <Card title={email ? 'Email' : 'Thêm email'} id="email">
      <p className="text-sm text-black/70">
        {email ? `Email hiện tại: ${email}` : 'Thêm email để đăng nhập và tự lấy lại mật khẩu khi quên.'}
      </p>
      <form action={action} className="flex flex-col gap-4">
        <Feedback state={state} id="email" />
        <TextField
          label="Email"
          name="email"
          id="email-new"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          key={state.email ?? 'email'}
        />
        <TextField
          label="Mật khẩu hiện tại"
          name="password"
          id="email-password"
          type="password"
          autoComplete="current-password"
          required
        />
        <SubmitButton pendingText="Đang lưu…">Lưu email</SubmitButton>
      </form>
    </Card>
  );
}

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <Card title="Đổi mật khẩu" id="doi-mat-khau">
      {forced && !state.ok ? (
        <p role="alert" className="rounded-xl bg-brand/20 px-4 py-3 text-sm font-bold">
          Bạn đang dùng mật khẩu tạm. Hãy đặt mật khẩu mới để tiếp tục.
        </p>
      ) : null}
      <form action={action} className="flex flex-col gap-4">
        <Feedback state={state} id="password" />
        <TextField
          label="Mật khẩu hiện tại"
          name="oldPassword"
          id="pw-old"
          type="password"
          autoComplete="current-password"
          required
        />
        <TextField
          label="Mật khẩu mới"
          name="newPassword"
          id="pw-new"
          type="password"
          autoComplete="new-password"
          required
          hint="Ít nhất 8 ký tự"
        />
        <TextField
          label="Nhập lại mật khẩu mới"
          name="confirm"
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton pendingText="Đang đổi…">Đổi mật khẩu</SubmitButton>
      </form>
    </Card>
  );
}
