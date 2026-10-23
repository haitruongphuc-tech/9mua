'use client';

import { useActionState } from 'react';
import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { tempPasswordAction } from './actions';

export function TempPassword({ userId }: { userId: string }) {
  const [state, action] = useActionState(tempPasswordAction.bind(null, userId), {});
  if (state.password)
    return (
      <p className="rounded-xl bg-brand/15 px-3 py-2 text-sm" data-testid="temp-password">
        Mật khẩu tạm: <b className="font-mono text-base">{state.password}</b> — người dùng phải đổi khi đăng
        nhập.
      </p>
    );
  return (
    <form action={action}>
      <ConfirmSubmit confirm="Cấp mật khẩu tạm (mật khẩu cũ mất hiệu lực)?" tone="plain">
        Mật khẩu tạm
      </ConfirmSubmit>
      {state.error ? <span className="ml-2 text-sm text-danger">{state.error}</span> : null}
    </form>
  );
}
