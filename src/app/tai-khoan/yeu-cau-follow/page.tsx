import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { followRequests } from '@/modules/social';
import { respondFollowRequestAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Yêu cầu follow', robots: { index: false } };

// Yêu cầu follow tài khoản riêng tư của tôi (SPEC-identity.md V5.2): chấp nhận hoặc từ chối.
export default async function FollowRequestsPage() {
  const user = await requireUser();
  const [t, requests] = await Promise.all([getT(), followRequests(user.id)]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
      <Link href="/tai-khoan/cai-dat#rieng-tu" className="text-[13px] font-bold text-white/60">
        {t('me.settings.back')}
      </Link>
      <h1 className="font-display text-[22px] font-black">{t('me.requests.title')}</h1>
      {requests.length === 0 ? (
        <p className="text-[13px] text-white/50">{t('me.requests.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="follow-requests">
          {requests.map((r) => (
            <li
              key={r.userId}
              className="flex items-center gap-3 rounded-[14px] bg-white/5 px-3 py-2"
              data-testid="follow-request"
            >
              <Link href={`/creator/${r.userId}`} className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar name={r.displayName} url={r.avatarUrl} className="h-9 w-9 text-[14px]" />
                <span className="truncate text-[13px] font-bold">{r.displayName}</span>
              </Link>
              <form action={respondFollowRequestAction.bind(null, r.userId, true)}>
                <button
                  type="submit"
                  className="h-8 rounded-full bg-brand px-3 text-[12px] font-black"
                  data-testid="follow-request-accept"
                >
                  {t('me.requests.accept')}
                </button>
              </form>
              <form action={respondFollowRequestAction.bind(null, r.userId, false)}>
                <button type="submit" className="h-8 rounded-full bg-white/10 px-3 text-[12px] font-black">
                  {t('me.requests.decline')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
