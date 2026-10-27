'use server';

import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { register, startSession } from '@/modules/identity';

type Field = 'identifier' | 'displayName' | 'password';

export type RegisterFormState = {
  values?: { identifier: string; displayName: string };
  fields?: Partial<Record<Field, string>>;
  message?: string;
};

const FIELD_ERRORS = {
  identifier: 'auth.err.identifier',
  displayName: 'auth.err.displayName',
  password: 'auth.err.password',
} as const;

export async function registerAction(_prev: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const input = {
    identifier: String(form.get('identifier') ?? ''),
    displayName: String(form.get('displayName') ?? ''),
    password: String(form.get('password') ?? ''),
  };
  const values = { identifier: input.identifier, displayName: input.displayName };
  const result = await register(input);

  if (!result.ok) {
    const t = await getT();
    if (result.error === 'IDENTIFIER_TAKEN') return { values, fields: { identifier: t('auth.err.taken') } };
    const fields: RegisterFormState['fields'] = {};
    for (const f of Object.keys(result.fields) as Field[]) fields[f] = t(FIELD_ERRORS[f]);
    return { values, fields };
  }

  // Đăng ký xong thì đăng nhập luôn và quay lại trang trước đó (SPEC-identity.md mục 1).
  await startSession(result.userId);
  redirect(safeNextPath(form.get('next')));
}
