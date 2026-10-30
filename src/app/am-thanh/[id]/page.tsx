import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT, type T } from '@/i18n/server';
import { readAnonId } from '@/lib/anon-id';
import { isFeatureOn } from '@/lib/features';
import { soundPage, type SoundView } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';
import { RenameSound } from './RenameSound';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

const nameOf = (t: T, s: SoundView) =>
  s.title
    ? s.artist
      ? `${s.title} – ${s.artist}`
      : s.title
    : t('post.sound.original', { name: s.authorName ?? '' });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [t, page] = await Promise.all([getT(), (await isFeatureOn('camera')) ? soundPage(id, {}) : null]);
  return page ? { title: nameOf(t, page.sound), alternates: { canonical: `/am-thanh/${id}` } } : {};
}

// Trang âm thanh (SPEC-creator.md V5.6 mục 2): tên, số video dùng, nghe thử, "Dùng âm thanh này", lưới video.
export default async function SoundPage({ params }: Props) {
  if (!(await isFeatureOn('camera'))) notFound();
  const { id } = await params;
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  const page = await soundPage(id, { userId: user?.id, anonId: await readAnonId() });
  if (!page) notFound();
  const { sound } = page;
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-5 md:px-6">
      <div className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-brand to-orange-400 text-3xl"
          >
            ♫
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-bold" data-testid="sound-title">
              {nameOf(t, sound)}
            </h1>
            <p className="text-[12px] font-bold text-white/60" data-testid="sound-count">
              {t('post.sound.uses', { count: page.total })}
            </p>
          </div>
        </div>
        <audio controls preload="none" src={sound.url} className="w-full" />
        {sound.selectable ? (
          <Link
            href={
              user
                ? `/video/dang?sound=${sound.id}`
                : `/dang-nhap?next=${encodeURIComponent(`/video/dang?sound=${sound.id}`)}`
            }
            className="flex h-12 items-center justify-center rounded-full bg-brand font-black text-white"
            data-testid="sound-use"
          >
            ♫ {t('post.sound.use')}
          </Link>
        ) : (
          <p
            className="rounded-[14px] bg-white/5 px-4 py-3 text-[13px] text-white/70"
            data-testid="sound-unavailable"
          >
            {t('post.sound.removed')}
          </p>
        )}
        {user && sound.kind === 'original' && sound.ownerId === user.id ? (
          <ClientMessages prefixes={['post.sound.']}>
            <RenameSound soundId={sound.id} title={sound.title ?? ''} />
          </ClientMessages>
        ) : null}
      </div>
      <h2 className="text-[14px] font-black">{t('post.sound.videos')}</h2>
      {page.videos.length ? (
        <VideoGrid
          showAuthor
          videos={page.videos.map((v) => ({
            id: v.id,
            posterUrl: v.posterUrl,
            caption: v.caption,
            views: v.views,
            likes: v.likes,
            authorName: v.author.displayName,
          }))}
        />
      ) : (
        <p className="mt-6 text-center text-[13px] text-white/50">{t('post.sound.empty')}</p>
      )}
    </div>
  );
}
