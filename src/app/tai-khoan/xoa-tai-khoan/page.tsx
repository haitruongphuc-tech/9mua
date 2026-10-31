import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { deletionBlockers } from '@/server/account-delete';
import { deleteAccountAction, sendDeleteCodeAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Xoá tài khoản', robots: { index: false } };

const ERRORS = [
  'BAD_PASSWORD',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'NO_EMAIL',
  'ADMIN',
  'SEND_FAILED',
  'NOT_FOUND',
] as const;
const field = 'h-11 rounded-[12px] border border-white/15 bg-white/5 px-3 text-[14px]';

// Xoá tài khoản (SPEC-identity.md V5.3): điều kiện, xác nhận bằng mật khẩu hoặc mã email, 30 ngày chờ.
export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-gui-ma'?: string }>;
}) {
  if (!(await isFeatureOn('account_more'))) notFound();
  const user = await requireUser();
  const [t, query, blockers] = await Promise.all([getT(), searchParams, deletionBlockers(user.id)]);
  const err = ERRORS.find((e) => e === query.loi);
  const admin = user.role === 'admin';
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <Link href="/tai-khoan/cai-dat" className="text-[13px] font-bold text-white/60">
        {t('me.settings.back')}
      </Link>
      <h1 className="font-display text-[22px] font-black">{t('me.delete.title')}</h1>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-white/75">
        <li>{t('me.delete.wait')}</li>
        <li>{t('me.delete.what')}</li>
        <li>{t('me.delete.keep')}</li>
      </ul>
      {admin ? (
        <p role="alert" className="text-[13px] font-bold text-red-300">
          {t('me.delete.err.ADMIN')}
        </p>
      ) : blockers.length ? (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-[14px] bg-red-500/10 p-3"
          data-testid="delete-blockers"
        >
          <p className="text-[13px] font-bold text-red-200">{t('me.delete.blocked')}</p>
          {blockers.map((b) => (
            <p key={b} className="text-[12px] text-red-200/90">
              • {t(`me.delete.blocker.${b}`)}
            </p>
          ))}
        </div>
      ) : (
        <>
          {err ? (
            <p role="alert" className="text-[13px] font-bold text-red-300" data-testid="delete-error">
              {t(`me.delete.err.${err}`)}
            </p>
          ) : null}
          <form
            action={deleteAccountAction}
            className="flex flex-col gap-2"
            data-testid="delete-password-form"
          >
            <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
              {t('me.delete.password')}
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={field}
              />
            </label>
            <button
              type="submit"
              className="h-11 rounded-full border border-danger text-[14px] font-black text-danger"
              data-testid="delete-submit"
            >
              {t('me.delete.confirm')}
            </button>
          </form>
          {user.email ? (
            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <p className="text-[12px] text-white/60">{t('me.delete.noPassword')}</p>
              <form action={sendDeleteCodeAction}>
                <button type="submit" className="h-10 rounded-full bg-white/10 px-4 text-[12px] font-black">
                  {t('me.delete.sendCode')}
                </button>
              </form>
              {query['da-gui-ma'] ? (
                <form action={deleteAccountAction} className="flex flex-col gap-2">
                  <p role="status" className="text-[12px] font-bold text-green-300">
                    {t('me.settings.codeSent', { email: user.email })}
                  </p>
                  <input
                    name="code"
                    inputMode="numeric"
                    required
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="000000"
                    className={field}
                  />
                  <button
                    type="submit"
                    className="h-11 rounded-full border border-danger text-[14px] font-black text-danger"
                  >
                    {t('me.delete.confirm')}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
