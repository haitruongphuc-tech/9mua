'use server';

import { requestPasswordReset } from '@/modules/identity';

export type ForgotFormState = { sent?: boolean; email?: string };

export async function forgotPasswordAction(_prev: ForgotFormState, form: FormData): Promise<ForgotFormState> {
  const email = String(form.get('email') ?? '');
  await requestPasswordReset(email);
  return { sent: true, email };
}
