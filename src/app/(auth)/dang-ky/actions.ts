'use server';

import { redirect } from 'next/navigation';
import { register } from '@/modules/identity';
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

  // T5 sẽ đăng nhập luôn sau khi đăng ký (SPEC-identity.md mục 1).
  const next = safeNextPath(form.get('next'));
  redirect(`/dang-nhap?da-dang-ky=1&next=${encodeURIComponent(next)}`);
}
