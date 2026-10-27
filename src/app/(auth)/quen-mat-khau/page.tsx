import type { Metadata } from 'next';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { AuthShell } from '../AuthShell';
import { ForgotForm } from './ForgotForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.forgot.title'), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <AuthShell title={t('auth.forgot.title')} lead={t('auth.forgot.lead')}>
      <ClientMessages prefixes={['auth.']}>
        <ForgotForm />
      </ClientMessages>
    </AuthShell>
  );
}
