import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { formatDateTime } from '@/lib/format';
import { isFeatureOn } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { provinceName } from '@/modules/kiot';
import { eventPage } from '@/modules/social';
import { EventActions } from './EventActions';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = (await isFeatureOn('events')) ? await eventPage(id, undefined) : null;
  return e ? { title: e.title, alternates: { canonical: `/su-kien/${id}` } } : { robots: { index: false } };
}

// Trang sự kiện (SPEC-social.md V5.7 mục 1): giờ, hình thức, địa điểm, mô tả, Quan tâm, báo cáo; chủ sự kiện huỷ được.
export default async function EventPage({ params }: Props) {
  if (!(await isFeatureOn('events'))) notFound();
  const { id } = await params;
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  const e = await eventPage(id, user?.id);
  if (!e) notFound();
  const where =
    e.mode === 'live'
      ? `🔴 ${t('feed.event.modeLive')}`
      : `📍 ${[e.address, e.province ? provinceName(e.province) : null].filter(Boolean).join(', ')}`;
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      {e.coverPath ? (
        <span className="relative block aspect-video overflow-hidden rounded-[16px]">
          <Image src={e.coverPath} alt="" fill sizes="512px" className="object-cover" unoptimized />
        </span>
      ) : null}
      <h1 className="font-display text-[22px] font-bold" data-testid="event-title">
        {e.title}
      </h1>
      {e.status !== 'active' ? (
        <p
          className="rounded-[14px] bg-white/5 px-4 py-3 text-[13px] font-bold text-white/70"
          data-testid="event-status"
        >
          {t(e.status === 'cancelled' ? 'feed.event.cancelled' : 'feed.event.removed')}
        </p>
      ) : null}
      <p className="text-[13px] text-brand">
        {formatDateTime(e.startsAt, t.lang)} → {formatDateTime(e.endsAt, t.lang)}
      </p>
      <p className="text-[13px] text-white/80">{where}</p>
      <Link href={`/creator/${e.ownerId}`} className="text-[13px] font-bold hover:underline">
        @{e.ownerName}
      </Link>
      {e.description ? (
        <p className="whitespace-pre-line text-[14px] text-white/85">{e.description}</p>
      ) : null}
      <ClientMessages prefixes={['feed.event.']}>
        <EventActions
          eventId={e.id}
          interested={e.interestedByMe}
          count={e.interested}
          mine={user?.id === e.ownerId}
          loggedIn={Boolean(user)}
          active={e.status === 'active'}
        />
      </ClientMessages>
      {user?.id === e.ownerId && e.status === 'active' ? (
        <form
          action={`/api/su-kien/${e.id}/anh-bia`}
          method="post"
          encType="multipart/form-data"
          className="flex items-center gap-2"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('feed.event.cover')}
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="min-w-0 text-[12px]"
            />
          </label>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-white/10 px-4 text-[12px] font-black"
          >
            {t('feed.event.upload')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
