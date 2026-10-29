import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/modules/identity';
import { socialModes } from '@/server/auth-modes';
import { AuthShell, OrDivider } from '../AuthShell';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('auth.register.submit'), robots: { index: false } };
}

// Đăng ký (SPEC-identity.md bổ sung 29/10): chỉ Zalo · Google · Facebook · Email nhận mã. Không còn form SĐT + mật khẩu.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  // Đã đăng nhập (vd. bấm "Tạo Kiot" ở trang chủ) thì đi thẳng tới trang cần tới.
  if (await getCurrentUser()) redirect(next);
  const t = await getT();
  return (
    <AuthShell title={t('auth.register.title')} lead={t('auth.register.lead')}>
      <SocialButtons
        modes={socialModes()}
        next={next}
        labels={{ zalo: t('auth.zalo'), google: t('common.google'), facebook: t('auth.facebook') }}
      />
      <OrDivider label={t('auth.or')} />
      <ClientMessages prefixes={['auth.']}>
        <EmailOtpForm next={next} askName />
      </ClientMessages>
      <p className="mt-5 text-center text-[13px] text-white/60">
        {t('auth.register.haveAccount')}{' '}
        <Link href={`/dang-nhap?next=${encodeURIComponent(next)}`} className="font-bold text-brand">
          {t('auth.login.submit')}
        </Link>
      </p>
    </AuthShell>
  );
}
