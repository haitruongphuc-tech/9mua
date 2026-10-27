import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GoogleButton } from '@/components/GoogleButton';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/modules/identity';
import { AuthShell, OrDivider } from '../AuthShell';
import { LoginForm } from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.login.submit'), robots: { index: false } };
}

const GOOGLE_ERRORS = { admin: 'auth.google.admin', khoa: 'auth.err.locked' } as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    'da-dat-lai'?: string;
    'lien-ket-google'?: string;
    'loi-google'?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);
  const t = await getT();
  const googleError = params['loi-google'];
  const notice = params['da-dat-lai']
    ? { tone: 'ok', text: t('auth.login.resetDone') }
    : params['lien-ket-google']
      ? { tone: 'info', text: t('auth.login.linkGoogle') }
      : googleError
        ? {
            tone: 'error',
            text: t(GOOGLE_ERRORS[googleError as keyof typeof GOOGLE_ERRORS] ?? 'auth.google.error'),
          }
        : null;
  return (
    <AuthShell title={t('auth.login.title')} lead={t('auth.login.lead')}>
      {notice ? (
        <p
          role="status"
          data-testid="login-notice"
          className={`mb-4 rounded-[14px] px-4 py-3 text-[13px] font-bold ${
            notice.tone === 'ok'
              ? 'bg-success/20 text-emerald-300'
              : notice.tone === 'info'
                ? 'border border-brand/40 bg-brand/10 text-white'
                : 'bg-danger/20 text-red-300'
          }`}
        >
          {notice.text}
        </p>
      ) : null}
      {params['lien-ket-google'] ? null : (
        <>
          <GoogleButton next={next} />
          <OrDivider label={t('auth.or')} />
        </>
      )}
      <ClientMessages prefixes={['auth.']}>
        <LoginForm next={next} />
      </ClientMessages>
    </AuthShell>
  );
}
