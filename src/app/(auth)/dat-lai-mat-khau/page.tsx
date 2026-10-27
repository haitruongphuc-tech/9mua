import type { Metadata } from 'next';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { AuthShell } from '../AuthShell';
import { ResetForm } from './ResetForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.reset.title'), robots: { index: false }, referrer: 'no-referrer' };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  const t = await getT();
  return (
    <AuthShell title={t('auth.reset.title')} lead={t('auth.reset.lead')}>
      <ClientMessages prefixes={['auth.']}>
        <ResetForm token={token} />
      </ClientMessages>
    </AuthShell>
  );
}
