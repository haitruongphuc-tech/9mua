import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GoogleButton } from '@/components/GoogleButton';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/modules/identity';
import { AuthShell, OrDivider } from '../AuthShell';
import { RegisterForm } from './RegisterForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.register.submit'), robots: { index: false } };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  // Đã đăng nhập (vd. bấm "Tạo Kiot" ở trang chủ) thì đi thẳng tới trang cần tới.
  if (await getCurrentUser()) redirect(next);
  const t = await getT();
  return (
    <AuthShell title={t('auth.register.title')} lead={t('auth.register.lead')}>
      <GoogleButton next={next} />
      <OrDivider label={t('auth.or')} />
      <ClientMessages prefixes={['auth.']}>
        <RegisterForm next={next} />
      </ClientMessages>
    </AuthShell>
  );
}
