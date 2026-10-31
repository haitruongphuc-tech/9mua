import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventCardView } from '@/components/social/EventCardView';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { PROVINCES } from '@/modules/kiot';
import { upcomingEvents } from '@/modules/social';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('feed.event.title'), alternates: { canonical: '/su-kien' } };
}

// Sự kiện sắp diễn ra (SPEC-social.md V5.7 mục 1), lọc theo tỉnh.
export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tinh?: string }> }) {
  if (!(await isFeatureOn('events'))) notFound();
  const [{ tinh }, t, user] = await Promise.all([searchParams, getT(), getCurrentUser()]);
  const province = PROVINCES.some((p) => p.slug === tinh) ? tinh! : null;
  const events = await upcomingEvents(user?.id, { province });
  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-[22px] font-bold">📅 {t('feed.event.title')}</h1>
        {user ? (
          <Link
            href="/su-kien/tao"
            className="h-10 rounded-full bg-brand px-4 text-[13px] font-black leading-10 text-white"
            data-testid="event-create-link"
          >
            ＋ {t('feed.event.create')}
          </Link>
        ) : null}
      </div>
      <form className="flex gap-2">
        <select
          name="tinh"
          defaultValue={province ?? ''}
          className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-3 text-[13px] text-white"
          aria-label={t('feed.event.province')}
        >
          <option value="">{t('feed.event.allProvinces')}</option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-full bg-white/10 px-4 text-[13px] font-bold">
          {t('feed.event.filter')}
        </button>
      </form>
      {events.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-white/50">{t('feed.event.empty')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="event-list">
          {events.map((e) => (
            <li key={e.id}>
              <EventCardView
                event={e}
                lang={t.lang}
                labels={{
                  live: t('feed.event.modeLive'),
                  interested: t('feed.event.interestedCount', { count: e.interested }),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
