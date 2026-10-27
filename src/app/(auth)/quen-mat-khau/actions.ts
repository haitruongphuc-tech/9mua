'use server';

import { getT } from '@/i18n/server';
import { requestPasswordReset } from '@/modules/identity';

export type ForgotFormState = { sent?: boolean; email?: string };

export async function forgotPasswordAction(_prev: ForgotFormState, form: FormData): Promise<ForgotFormState> {
  const email = String(form.get('email') ?? '');
  const t = await getT();
  // Email gửi theo ngôn ngữ người yêu cầu đang dùng (SPEC-i18n.md mục 4).
  await requestPasswordReset(email, {
    subject: t('auth.mail.subject'),
    title: t('auth.mail.title'),
    greeting: t('auth.mail.greeting'),
    paragraph: t('auth.mail.paragraph'),
    action: t('auth.mail.action'),
    footnote: t('auth.mail.footnote'),
  });
  return { sent: true, email };
}
