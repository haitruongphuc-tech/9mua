'use server';

import { redirect } from 'next/navigation';
import { register, startSession } from '@/modules/identity';
import { safeNextPath } from '@/lib/safe-next-path';

export type RegisterFormState = {
  values?: { identifier: string; displayName: string };
  fields?: Partial<Record<'identifier' | 'displayName' | 'password', string>>;
  message?: string;
};

export async function registerAction(_prev: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const input = {
    identifier: String(form.get('identifier') ?? ''),
    displayName: String(form.get('displayName') ?? ''),
    password: String(form.get('password') ?? ''),
  };
  const values = { identifier: input.identifier, displayName: input.displayName };
  const result = await register(input);

  if (!result.ok) {
    if (result.error === 'IDENTIFIER_TAKEN') {
      return { values, fields: { identifier: 'Tài khoản đã tồn tại. Hãy đăng nhập.' } };
    }
    return { values, fields: result.fields };
  }

  // Đăng ký xong thì đăng nhập luôn và quay lại trang trước đó (SPEC-identity.md mục 1).
  await startSession(result.userId);
  redirect(safeNextPath(form.get('next')));
}
