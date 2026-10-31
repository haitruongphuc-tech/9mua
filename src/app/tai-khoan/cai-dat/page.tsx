import type { Metadata } from 'next';
import Link from 'next/link';
import { logoutAction, logoutOtherDevicesAction } from '@/app/(auth)/actions';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { handleInfo, requireUser } from '@/modules/identity';
import { listBlockedUsers, listMutedKeywords, MENTION_POLICIES, mentionPolicyOf } from '@/modules/social';
import {
  addMutedKeywordAction,
  removeMutedKeywordAction,
  setMentionPolicyAction,
  setNotifyTypesAction,
  setShowLikedAction,
} from './social-actions';
import { likedTabPublic } from '@/modules/social';
import { NOTIFY_TYPES, notifyOffTypes } from '@/lib/notify-events';
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
  searchParams: Promise<{ 'da-dang-xuat-thiet-bi-khac'?: string; 'da-luu'?: string; 'loi-tu-cam'?: string }>;
}) {
  const user = await requireUser();
  const [params, t, handleOn, blockOn] = await Promise.all([
    searchParams,
    getT(),
    isFeatureOn('account_more'),
    isFeatureOn('social_more'),
  ]);
  const blocked = blockOn ? await listBlockedUsers(user.id) : [];
  // Nhắc tên và từ cấm (SPEC-social.md V5.4), công tắc social_more.
  const muted = blockOn ? await listMutedKeywords(user.id) : [];
  const policy = blockOn ? await mentionPolicyOf(user.id) : 'everyone';
  const mutedError = params['loi-tu-cam'];
  const notifyOff = blockOn ? await notifyOffTypes(user.id) : [];
  const likedPublic = blockOn ? await likedTabPublic(user.id) : false;
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
          {blockOn ? (
            <Card title={t('me.settings.liked.title')} id="da-thich">
              <form action={setShowLikedAction} className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="show"
                    defaultChecked={likedPublic}
                    className="h-4 w-4 accent-[#ff6b00]"
                    data-testid="liked-public"
                  />
                  {t('me.settings.liked.public')}
                </label>
                <button
                  type="submit"
                  className="h-10 w-fit rounded-full bg-white/10 px-4 text-[12px] font-black"
                  data-testid="liked-save"
                >
                  {t('me.settings.save')}
                </button>
              </form>
            </Card>
          ) : null}
          {blockOn ? (
            <Card title={t('me.settings.notify.title')} id="thong-bao">
              <p className="text-[12px] text-white/60">{t('me.settings.notify.hint')}</p>
              <form action={setNotifyTypesAction} className="flex flex-col gap-2" data-testid="notify-types">
                {NOTIFY_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      name={`n.${type}`}
                      defaultChecked={!notifyOff.includes(type)}
                      className="h-4 w-4 accent-[#ff6b00]"
                      data-testid={`notify-type-${type}`}
                    />
                    {t(`me.settings.notify.type.${type}`)}
                  </label>
                ))}
                <button
                  type="submit"
                  className="h-10 w-fit rounded-full bg-white/10 px-4 text-[12px] font-black"
                  data-testid="notify-save"
                >
                  {t('me.settings.save')}
                </button>
              </form>
            </Card>
          ) : null}
          {blockOn ? (
            <Card title={t('me.settings.mention.title')} id="nhac-ten">
              <form
                action={setMentionPolicyAction}
                className="flex flex-col gap-2"
                data-testid="mention-policy"
              >
                {MENTION_POLICIES.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      name="policy"
                      value={p}
                      defaultChecked={policy === p}
                      className="accent-[#ff6b00]"
                    />
                    {t(`me.settings.mention.${p}`)}
                  </label>
                ))}
                <button
                  type="submit"
                  className="h-10 w-fit rounded-full bg-white/10 px-4 text-[12px] font-black"
                >
                  {t('me.settings.save')}
                </button>
              </form>
            </Card>
          ) : null}
          {blockOn ? (
            <Card title={t('me.settings.muted.title', { count: muted.length })} id="tu-cam">
              <p className="text-[12px] text-white/60">{t('me.settings.muted.hint')}</p>
              {mutedError ? (
                <p role="alert" className="text-[12px] font-bold text-red-300">
                  {t(
                    `me.settings.muted.err.${mutedError === 'LIMIT' ? 'LIMIT' : mutedError === 'DUPLICATE' ? 'DUPLICATE' : 'INVALID'}`,
                  )}
                </p>
              ) : null}
              <ul className="flex flex-wrap gap-2" data-testid="muted-words">
                {muted.map((m) => (
                  <li key={m.id}>
                    <form action={removeMutedKeywordAction.bind(null, m.id)}>
                      <button
                        type="submit"
                        className="h-8 rounded-full bg-white/10 px-3 text-[12px] font-bold"
                        aria-label={t('me.settings.muted.remove', { word: m.word })}
                      >
                        {m.word} ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={addMutedKeywordAction} className="flex gap-2">
                <input
                  name="word"
                  required
                  maxLength={30}
                  placeholder={t('me.settings.muted.placeholder')}
                  className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 px-3 text-[14px] text-white"
                  data-testid="muted-input"
                />
                <button
                  type="submit"
                  className="h-11 shrink-0 rounded-full bg-brand px-4 text-[12px] font-black text-white"
                  data-testid="muted-add"
                >
                  {t('me.settings.muted.add')}
                </button>
              </form>
            </Card>
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
