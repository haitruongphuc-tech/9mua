import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { myGroups, suggestedGroups, type GroupCard } from '@/modules/social';
import { GroupCardView } from './GroupCardView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Nhóm', alternates: { canonical: '/nhom' } };

// /nhom (SPEC-social.md V5.10 mục 4): nhóm của tôi, gợi ý nhóm công khai, tạo nhóm.
export default async function GroupsPage() {
  if (!(await isFeatureOn('groups'))) notFound();
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  const [mine, suggested] = await Promise.all([user ? myGroups(user.id) : [], suggestedGroups(user?.id)]);
  const card = (g: GroupCard) => (
    <li key={g.id}>
      <GroupCardView
        group={g}
        labels={{
          privacy: t(g.privacy === 'private' ? 'feed.group.private' : 'feed.group.public'),
          members: t('feed.group.memberCount', { count: g.memberCount }),
        }}
      />
    </li>
  );
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold">👥 {t('feed.group.title')}</h1>
        {user ? (
          <Link
            href="/nhom/tao"
            className="flex h-10 items-center rounded-full bg-brand px-4 text-[13px] font-black"
            data-testid="group-create-link"
          >
            ＋ {t('feed.group.create')}
          </Link>
        ) : null}
      </div>
      {mine.length ? (
        <section>
          <h2 className="mb-2 text-[13px] font-bold text-white/70">{t('feed.group.mine')}</h2>
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="group-mine">
            {mine.map(card)}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-[13px] font-bold text-white/70">{t('feed.group.suggested')}</h2>
        {suggested.length ? (
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="group-suggested">
            {suggested.map(card)}
          </ul>
        ) : (
          <p className="text-[13px] text-white/50">{t('feed.group.empty')}</p>
        )}
      </section>
    </div>
  );
}
