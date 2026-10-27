import { Radio } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LiveFeed } from '@/components/live/LiveFeed';
import { StoriesRow } from '@/components/live/StoriesRow';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { readAnonId } from '@/lib/anon-id';
import { listStories } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';
import { getLiveForViewer, listLiveNow, type LiveView } from '@/modules/live';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Live', robots: { index: false } };

// Trang Live (V4 trang 03): Story 24 giờ ở đầu, slogan, khung xem live vuốt dọc; bên cạnh là nút Phát live và danh sách
// buổi đang live (SPEC-live.md mục 4).
export default async function LivePage() {
  const [t, stories, user, anonId, cards] = await Promise.all([
    getT(),
    listStories(),
    getCurrentUser(),
    readAnonId(),
    listLiveNow(),
  ]);
  const views = (
    await Promise.all(cards.map((c) => getLiveForViewer(c.id, { userId: user?.id, anonId })))
  ).filter((v): v is Extract<LiveView, { kind: 'live' }> => v?.kind === 'live');
  return (
    <div className="mx-auto max-w-[1100px] px-3 py-4 md:px-6">
      <ClientMessages prefixes={['live.', 'shop.cart.']}>
        <StoriesRow groups={stories} />
        <p className="mt-3 text-center font-display text-[18px] font-black md:text-[22px]">
          {t('common.slogan.live')}
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
          {views.length ? (
            <LiveFeed lives={views} loggedIn={Boolean(user)} />
          ) : (
            <div
              className="flex h-[420px] flex-col items-center justify-center rounded-[20px] border border-white/10 bg-white/5 px-6 text-center"
              data-testid="live-empty"
            >
              <h1 className="font-display text-[22px] font-bold">{t('live.empty.title')}</h1>
              <p className="mt-2 text-[13px] text-white/60">{t('live.empty.body')}</p>
              <Link href="/" className="mt-4 text-[13px] font-bold text-white/70 underline">
                {t('live.empty.cta')}
              </Link>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Link
              href="/live/phat"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[14px] font-black shadow-[0_0_18px_rgb(255_107_0/0.5)]"
              data-testid="go-live"
            >
              <Radio className="h-5 w-5" aria-hidden /> {t('live.go').toUpperCase()}
            </Link>
            {cards.length ? (
              <ul className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-white/5 p-3">
                {cards.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/live/${c.id}`}
                      className="flex items-center gap-2 rounded-[12px] bg-black/40 p-2"
                    >
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black">
                        {t('live.badge')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold">{c.title}</span>
                        <span className="block truncate text-[11px] text-white/60">
                          {c.host.kiot?.name ?? c.host.displayName} ·{' '}
                          {t('live.viewers', { count: c.viewers })}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </ClientMessages>
    </div>
  );
}
