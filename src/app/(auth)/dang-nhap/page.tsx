import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { LINK_COOKIE } from '@/lib/google-cookies';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser, linkTicketEmail } from '@/modules/identity';
import { socialModes } from '@/server/auth-modes';
import { AuthShell, OrDivider } from '../AuthShell';
import { LoginForm } from './LoginForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.login.submit'), robots: { index: false } };
}

const PROVIDER_NAME: Record<string, string> = {
  google: 'Google',
  zalo: 'Zalo',
  facebook: 'Facebook',
  apple: 'Apple',
};

// Đăng nhập (SPEC-identity.md bổ sung 29/10): Zalo · Google · Facebook, mã email, và mật khẩu cho tài khoản cũ/admin.
// Email Google/Facebook trùng tài khoản có sẵn: nhập mã gửi về email đó hoặc mật khẩu để liên kết.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    'da-dat-lai'?: string;
    'lien-ket-google'?: string;
    'lien-ket'?: string;
    'loi-google'?: string;
    'loi-dang-nhap'?: string;
    qua?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);
  const t = await getT();
  const linkProvider = params['lien-ket'] ?? (params['lien-ket-google'] ? 'google' : null);
  const linkEmail = linkProvider ? linkTicketEmail((await cookies()).get(LINK_COOKIE)?.value) : null;
  const errorCode = params['loi-dang-nhap'] ?? params['loi-google'];
  const errorProvider = PROVIDER_NAME[params['loi-google'] ? 'google' : (params.qua ?? '')] ?? 'Google';
  const notice = params['da-dat-lai']
    ? { tone: 'ok', text: t('auth.login.resetDone') }
    : linkProvider && linkEmail
      ? {
          tone: 'info',
          text: t('auth.login.linkProvider', {
            email: linkEmail,
            provider: PROVIDER_NAME[linkProvider] ?? linkProvider,
          }),
        }
      : linkProvider
        ? { tone: 'error', text: t('auth.otp.err.TICKET_EXPIRED') }
        : errorCode
          ? {
              tone: 'error',
              text:
                errorCode === 'admin'
                  ? t('auth.oauth.admin', { provider: errorProvider })
                  : errorCode === 'khoa'
                    ? t('auth.err.locked')
                    : t('auth.oauth.error', { provider: errorProvider }),
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
      <ClientMessages prefixes={['auth.']}>
        {linkProvider && linkEmail ? (
          <EmailOtpForm mode="link" linkEmail={linkEmail} next={next} />
        ) : (
          <>
            <SocialButtons
              modes={await socialModes()}
              next={next}
              labels={{
                zalo: t('auth.zalo'),
                google: t('common.google'),
                facebook: t('auth.facebook'),
                apple: t('auth.apple'),
              }}
            />
            <OrDivider label={t('auth.or')} />
            <EmailOtpForm next={next} />
          </>
        )}
        <OrDivider label={t('auth.passwordLogin')} />
        <LoginForm next={next} />
      </ClientMessages>
    </AuthShell>
  );
}
