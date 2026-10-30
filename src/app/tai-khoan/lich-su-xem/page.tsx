import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { isHistoryOff, viewHistory } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { clearHistoryAction, removeHistoryAction, setHistoryOffAction } from './actions';

export const metadata: Metadata = { robots: { index: false } };

// Lịch sử đã xem (SPEC-creator.md V5.2): video xem ≥ 3 giây trong 90 ngày, mới nhất trước, 30 video mỗi trang.
export default async function WatchHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ trang?: string }>;
}) {
  const user = await requireUser();
  if (!(await isFeatureOn('feed_tools'))) notFound();
  const page = Math.max(1, Number.parseInt((await searchParams).trang ?? '1', 10) || 1);
  const [t, history, off] = await Promise.all([getT(), viewHistory(user.id, page), isHistoryOff(user.id)]);
  const button = 'h-9 rounded-full bg-white/10 px-4 text-[13px] font-black';
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('me.history.title')}</h1>
      <div className="flex flex-wrap gap-2">
        <form action={setHistoryOffAction.bind(null, !off)}>
          <button type="submit" className={button} data-testid="history-toggle">
            {off ? t('me.history.turnOn') : t('me.history.turnOff')}
          </button>
        </form>
        {history.items.length ? (
          <form action={clearHistoryAction}>
            <button type="submit" className={button} data-testid="history-clear">
              {t('me.history.clear')}
            </button>
          </form>
        ) : null}
      </div>
      {off ? <p className="text-[13px] text-white/60">{t('me.history.offNote')}</p> : null}
      {history.items.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('me.history.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" data-testid="history-list">
          {history.items.map((v) => (
            <li key={v.id} className="flex flex-col gap-1">
              <Link
                href={`/v/${v.id}`}
                className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-black"
              >
                {v.posterUrl ? (
                  <Image
                    src={v.posterUrl}
                    alt={v.caption || 'Video'}
                    fill
                    sizes="33vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 p-1.5 text-[11px] font-bold">
                  @{v.authorName}
                </span>
              </Link>
              <form action={removeHistoryAction.bind(null, v.id)}>
                <button type="submit" className="w-full text-[12px] font-bold text-white/60 underline">
                  {t('me.history.remove')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {history.hasMore ? (
        <Link
          href={`/tai-khoan/lich-su-xem?trang=${page + 1}`}
          className="text-center text-[13px] font-bold text-brand"
        >
          {t('me.history.more')}
        </Link>
      ) : null}
    </section>
  );
}
