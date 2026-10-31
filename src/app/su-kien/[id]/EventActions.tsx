'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { cancelEventAction } from '../actions';

// Quan tâm (nhận thông báo 1 giờ trước), báo cáo; chủ sự kiện huỷ.
export function EventActions({
  eventId,
  interested: initial,
  count: initialCount,
  mine,
  loggedIn,
  active,
}: {
  eventId: string;
  interested: boolean;
  count: number;
  mine: boolean;
  loggedIn: boolean;
  active: boolean;
}) {
  const t = useT();
  const [interested, setInterested] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [reported, setReported] = useState(false);
  const login = () => window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/su-kien/${eventId}`)}`);
  const toggle = async () => {
    if (!loggedIn) return login();
    const r = await fetch(`/api/su-kien/${eventId}/quan-tam`, { method: 'POST' })
      .then((x) => x.json() as Promise<{ ok: boolean; interested: boolean }>)
      .catch(() => null);
    if (r?.ok) {
      setInterested(r.interested);
      setCount((c) => c + (r.interested ? 1 : -1));
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {active && !mine ? (
        <button
          type="button"
          onClick={() => void toggle()}
          aria-pressed={interested}
          className={`h-11 rounded-full px-5 text-[13px] font-black ${interested ? 'bg-white/10' : 'bg-brand text-white'}`}
          data-testid="event-interest"
        >
          {interested ? `✓ ${t('feed.event.interested')}` : `☆ ${t('feed.event.interest')}`}
        </button>
      ) : null}
      <span className="text-[12px] text-white/60" data-testid="event-interest-count">
        {t('feed.event.interestedCount', { count })}
      </span>
      {mine && active ? (
        <form action={cancelEventAction.bind(null, eventId)}>
          <button
            type="submit"
            className="h-10 rounded-full border border-white/20 px-4 text-[12px] font-bold"
            data-testid="event-cancel"
          >
            {t('feed.event.cancel')}
          </button>
        </form>
      ) : null}
      {!mine && loggedIn && !reported ? (
        <button
          type="button"
          onClick={async () => {
            await fetch(`/api/su-kien/${eventId}/bao-cao`, { method: 'POST' }).catch(() => {});
            setReported(true);
          }}
          className="ml-auto text-[12px] font-bold text-white/50"
          data-testid="event-report"
        >
          ⚑ {t('feed.event.report')}
        </button>
      ) : reported ? (
        <span className="ml-auto text-[12px] text-green-300">{t('feed.event.reported')}</span>
      ) : null}
    </div>
  );
}
