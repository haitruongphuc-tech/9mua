import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/post/PostCard';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { groupAdminData } from '@/modules/social';
import {
  approveMemberAction,
  banMemberAction,
  moderateGroupPostAction,
  setApprovePostsAction,
  setGroupAdminAction,
} from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quản trị nhóm', robots: { index: false } };

const btn = 'h-8 rounded-full px-3 text-[12px] font-bold';

// Quản trị nhóm (SPEC-social.md V5.10 mục 2): ảnh nhóm, duyệt người vào, bật/tắt duyệt bài, duyệt / xoá bài, cấm thành
// viên; người tạo đặt tối đa 3 quản trị viên.
export default async function GroupAdminPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureOn('groups'))) notFound();
  const user = await requireUser();
  const { id } = await params;
  const [t, data] = await Promise.all([getT(), groupAdminData(user.id, id)]);
  if (!data) notFound();
  const { group, myRole, members, pendingPosts } = data;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6">
      <Link href={`/nhom/${group.id}`} className="text-[13px] text-white/60 hover:underline">
        ← {group.name}
      </Link>
      <h1 className="font-display text-[20px] font-bold">⚙ {t('feed.group.manage')}</h1>

      <form
        action={`/api/nhom/${group.id}/anh`}
        method="post"
        encType="multipart/form-data"
        className="flex items-center gap-2"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('feed.group.avatar')}
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp"
            className="min-w-0 text-[12px]"
          />
        </label>
        <button type="submit" className="h-10 shrink-0 rounded-full bg-white/10 px-4 text-[12px] font-black">
          {t('feed.event.upload')}
        </button>
      </form>

      <form action={setApprovePostsAction.bind(null, group.id)} className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="on"
            defaultChecked={group.approvePosts}
            className="h-4 w-4 accent-[#ff6b00]"
            data-testid="group-approve-posts"
          />
          {t('feed.group.approvePosts')}
        </label>
        <button type="submit" className={`${btn} bg-white/10`} data-testid="group-approve-save">
          {t('me.settings.save')}
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-white/70">
          {t('feed.group.pendingPosts', { count: pendingPosts.length })}
        </h2>
        <ClientMessages prefixes={['feed.post.', 'feed.share', 'feed.reaction']}>
          <ul className="flex flex-col gap-3" data-testid="group-pending-posts">
            {pendingPosts.map((item) => (
              <li key={item.id} className="flex flex-col gap-2">
                {item.post ? <PostCard post={item.post} loggedIn /> : null}
                {item.video ? (
                  <Link href={`/v/${item.video.id}`} className="text-[13px] underline">
                    🎬 {item.video.caption || item.video.id}
                  </Link>
                ) : null}
                <div className="flex gap-2">
                  <form action={moderateGroupPostAction.bind(null, group.id, item.id, 'approve')}>
                    <button type="submit" className={`${btn} bg-brand`} data-testid="group-post-approve">
                      {t('feed.group.approve')}
                    </button>
                  </form>
                  <form action={moderateGroupPostAction.bind(null, group.id, item.id, 'remove')}>
                    <button type="submit" className={`${btn} bg-white/10`}>
                      {t('feed.group.remove')}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </ClientMessages>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-white/70">{t('feed.group.members')}</h2>
        <ul className="flex flex-col gap-2" data-testid="group-members">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-white/5 px-3 py-2"
              data-testid="group-member"
            >
              <span className="text-[13px]">
                <Link href={`/creator/${m.userId}`} className="font-bold hover:underline">
                  {m.displayName}
                </Link>{' '}
                <span className="text-white/50">
                  · {t(`feed.group.role.${m.role === 'owner' || m.role === 'admin' ? m.role : 'member'}`)}
                  {m.status !== 'active'
                    ? ` · ${t(m.status === 'pending' ? 'feed.group.pending' : 'feed.group.banned')}`
                    : ''}
                </span>
              </span>
              <span className="flex gap-1">
                {m.status === 'pending' ? (
                  <>
                    <form action={approveMemberAction.bind(null, group.id, m.userId, true)}>
                      <button type="submit" className={`${btn} bg-brand`} data-testid="group-member-approve">
                        {t('feed.group.approve')}
                      </button>
                    </form>
                    <form action={approveMemberAction.bind(null, group.id, m.userId, false)}>
                      <button type="submit" className={`${btn} bg-white/10`}>
                        {t('feed.group.decline')}
                      </button>
                    </form>
                  </>
                ) : null}
                {myRole === 'owner' && m.status === 'active' && m.role !== 'owner' ? (
                  <form action={setGroupAdminAction.bind(null, group.id, m.userId, m.role !== 'admin')}>
                    <button type="submit" className={`${btn} bg-white/10`}>
                      {t(m.role === 'admin' ? 'feed.group.unmakeAdmin' : 'feed.group.makeAdmin')}
                    </button>
                  </form>
                ) : null}
                {m.status !== 'banned' &&
                m.role !== 'owner' &&
                m.userId !== user.id &&
                (myRole === 'owner' || m.role === 'member') ? (
                  <form action={banMemberAction.bind(null, group.id, m.userId)}>
                    <button
                      type="submit"
                      className={`${btn} bg-red-500/20 text-red-200`}
                      data-testid="group-member-ban"
                    >
                      {t('feed.group.ban')}
                    </button>
                  </form>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
