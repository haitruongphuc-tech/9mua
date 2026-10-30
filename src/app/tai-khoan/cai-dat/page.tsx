import type { Metadata } from 'next';
import Link from 'next/link';
import { logoutAction, logoutOtherDevicesAction } from '@/app/(auth)/actions';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { handleInfo, requireUser } from '@/modules/identity';
import { listBlockedUsers } from '@/modules/social';
import { Avatar } from '@/components/ui/Avatar';
import { BlockButton } from '@/components/social/BlockButton';
import { isFeatureOn } from '@/lib/features';
import { formatDate } from '@/lib/format';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { Card, EmailForm, HandleForm, PasswordForm, SetPasswordForm } from '../AccountForms';

export const metadata: Metadata = { title: 'Cài đặt tài khoản', robots: { index: false } };

// Cài đặt tài khoản (tách khỏi trang Tôi ở T65): tên, email, mật khẩu, thiết bị.
export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-dang-xuat-thiet-bi-khac'?: string }>;
}) {
  const user = await requireUser();
  const [params, t, handleOn, blockOn] = await Promise.all([
    searchParams,
    getT(),
    isFeatureOn('account_more'),
    isFeatureOn('social_more'),
  ]);
  const blocked = blockOn ? await listBlockedUsers(user.id) : [];
  const handle = handleOn ? await handleInfo(user.id) : null;
  return (
    <ClientMessages prefixes={['me.settings.', 'auth.otp.', 'auth.addEmail.']}>
      <div>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
          <Link href="/tai-khoan" className="text-[13px] font-bold text-white/60">
            {t('me.settings.back')}
          </Link>
          <h1 className="font-display text-[22px] font-black">{t('me.settings.title')}</h1>
          {user.mustChangePassword ? <PasswordForm forced /> : null}
          {handle?.handle ? (
            <HandleForm
              handle={handle.handle}
              nextChange={handle.nextChangeAt ? formatDate(handle.nextChangeAt, t.lang) : null}
            />
          ) : null}
          {/* Tên, ảnh, giới thiệu chuyển sang trang Sửa hồ sơ (SPEC-social.md bổ sung 30/10, A2). */}
          <Card title={t('me.settings.info')} id="thong-tin">
            <p className="text-[13px] text-white/60">{t('me.settings.profileHint')}</p>
            <Link
              href="/tai-khoan/ho-so"
              className="h-11 rounded-full bg-white/10 text-center text-[14px] font-black leading-[44px]"
            >
              {t('profile.edit.button')} →
            </Link>
          </Card>
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

          {blockOn ? (
            // Danh sách chặn trên toàn web, gộp cả chặn ở Hộp thư (SPEC-social.md V5.3).
            <Card title={t('common.block.list')} id="da-chan">
              {blocked.length === 0 ? (
                <p className="text-[13px] text-white/60">{t('common.block.empty')}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-white/10" data-testid="blocked-list">
                  {blocked.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 py-2">
                      <Avatar name={u.displayName} url={u.avatarUrl} className="h-9 w-9 text-[14px]" />
                      <span className="min-w-0 flex-1 truncate font-bold">{u.displayName}</span>
                      <BlockButton
                        userId={u.id}
                        name={u.displayName}
                        unblock
                        className="h-8 rounded-full bg-white/10 px-3 text-[12px] font-black"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

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
