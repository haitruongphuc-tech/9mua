import type { Metadata } from 'next';
import Link from 'next/link';
import { logoutAction, logoutOtherDevicesAction } from '@/app/(auth)/actions';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { Card, EmailForm, PasswordForm, ProfileForm, SetPasswordForm } from '../AccountForms';

export const metadata: Metadata = { title: 'Cài đặt tài khoản', robots: { index: false } };

// Cài đặt tài khoản (tách khỏi trang Tôi ở T65): tên, email, mật khẩu, thiết bị.
export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-dang-xuat-thiet-bi-khac'?: string }>;
}) {
  const user = await requireUser();
  const [params, t] = await Promise.all([searchParams, getT()]);
  return (
    <ClientMessages prefixes={['me.settings.', 'auth.otp.', 'auth.addEmail.']}>
      <div>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
          <Link href="/tai-khoan" className="text-[13px] font-bold text-white/60">
            {t('me.settings.back')}
          </Link>
          <h1 className="font-display text-[22px] font-black">{t('me.settings.title')}</h1>
          {user.mustChangePassword ? <PasswordForm forced /> : null}
          <ProfileForm displayName={user.displayName} />
          {user.email ? (
            <EmailForm email={user.email} />
          ) : (
            // Chưa có email (thường là tài khoản Zalo): thêm email bằng mã, không cần mật khẩu (SPEC-identity.md 29/10).
            <Card title={t('me.settings.addEmail')} id="email">
              <p className="text-[13px] text-white/60">{t('me.settings.addEmailHint')}</p>
              <EmailOtpForm mode="add-email" />
            </Card>
          )}
          {user.mustChangePassword ? null : <PasswordForm forced={false} />}
          <SetPasswordForm email={user.email} />

          <Card title={t('me.settings.devices')} id="thiet-bi">
            {params['da-dang-xuat-thiet-bi-khac'] ? (
              <p
                role="status"
                className="rounded-[14px] bg-success/15 px-4 py-3 text-[13px] font-bold text-success"
              >
                {t('me.settings.loggedOutOthers')}
              </p>
            ) : null}
            <form action={logoutOtherDevicesAction}>
              <button type="submit" className="h-11 w-full rounded-full bg-white/10 text-[14px] font-black">
                {t('me.settings.logoutOthers')}
              </button>
            </form>
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-11 w-full rounded-full border border-danger text-[14px] font-black text-danger"
              >
                {t('me.logout')}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </ClientMessages>
  );
}
