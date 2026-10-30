import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { getT } from '@/i18n/server';
import { getPublicProfile } from '@/modules/identity';
import { followList } from '@/modules/social';

export const metadata: Metadata = { robots: { index: false } };

// Danh sách Người theo dõi (mặc định) / Đang theo dõi (?dang=1) của một trang cá nhân, 30 người mỗi trang
// (SPEC-social.md bổ sung 30/10, A2). Chỉ có tên và ảnh đại diện.
export default async function FollowListPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ dang?: string; trang?: string }>;
}) {
  const [{ userId }, query, t] = await Promise.all([params, searchParams, getT()]);
  const profile = await getPublicProfile(userId);
  if (!profile) notFound();
  const kind = query.dang ? 'following' : 'followers';
  const page = Math.max(1, Number.parseInt(query.trang ?? '1', 10) || 1);
  const { items, hasMore } = await followList(userId, kind, page);
  const base = `/creator/${userId}/theo-doi${kind === 'following' ? '?dang=1&' : '?'}`;
  const tab = (on: boolean) =>
    `flex-1 border-b-2 pb-2 text-center text-[14px] font-bold ${on ? 'border-white text-white' : 'border-transparent text-white/50'}`;
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link
        href={`/creator/${userId}`}
        className="flex items-center gap-2 text-[13px] font-bold text-white/70"
      >
        <Avatar name={profile.displayName} url={profile.avatarUrl} className="h-7 w-7 text-[12px]" />
        {profile.displayName}
      </Link>
      <h1 className="font-display text-[20px] font-black">
        {t(kind === 'followers' ? 'profile.list.followers' : 'profile.list.following', {
          name: profile.displayName,
        })}
      </h1>
      <nav className="flex border-b border-white/10">
        <Link href={`/creator/${userId}/theo-doi`} className={tab(kind === 'followers')}>
          {t('profile.stat.followers')}
        </Link>
        <Link href={`/creator/${userId}/theo-doi?dang=1`} className={tab(kind === 'following')}>
          {t('profile.stat.following')}
        </Link>
      </nav>
      {items.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-white/60">
          {t(kind === 'followers' ? 'profile.list.emptyFollowers' : 'profile.list.emptyFollowing')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/10" data-testid="follow-list">
          {items.map((u) => (
            <li key={u.id}>
              <Link
                href={`/creator/${u.id}`}
                className="flex items-center gap-3 py-3"
                data-testid="follow-person"
              >
                <Avatar name={u.displayName} url={u.avatarUrl} className="h-11 w-11 text-[16px]" />
                <span className="truncate font-bold">{u.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between text-[13px] font-bold">
        {page > 1 ? <Link href={`${base}trang=${page - 1}`}>{t('profile.list.prev')}</Link> : <span />}
        {hasMore ? <Link href={`${base}trang=${page + 1}`}>{t('profile.list.next')}</Link> : null}
      </div>
    </section>
  );
}
