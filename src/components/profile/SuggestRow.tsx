'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useT } from '@/i18n/client';

type Person = {
  id: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  mutual: number;
};

// Gợi ý follow (SPEC-social.md V5.1 mục 2): hàng thẻ cuộn ngang, Follow ngay hoặc Ẩn 30 ngày.
export function SuggestRow({ people }: { people: Person[] }) {
  const t = useT();
  const [list, setList] = useState(people);
  const [followed, setFollowed] = useState<string[]>([]);
  if (!list.length) return null;
  const follow = async (id: string) => {
    const r = await fetch('/api/social/follow', { method: 'POST', body: JSON.stringify({ userId: id }) })
      .then((x) => x.json() as Promise<{ ok: boolean; following?: boolean }>)
      .catch(() => null);
    if (r?.ok) setFollowed((l) => (r.following ? [...l, id] : l.filter((x) => x !== id)));
  };
  const hide = async (id: string) => {
    setList((l) => l.filter((p) => p.id !== id));
    await fetch('/api/social/suggest-dismiss', {
      method: 'POST',
      body: JSON.stringify({ userId: id }),
    }).catch(() => {});
  };
  return (
    <section className="flex flex-col gap-2" data-testid="follow-suggestions">
      <h2 className="text-[13px] font-black">{t('profile.suggest.title')}</h2>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {list.map((p) => (
          <li
            key={p.id}
            className="relative flex w-36 shrink-0 flex-col items-center gap-1 rounded-[16px] bg-white/5 p-3 text-center"
            data-testid="suggest-card"
          >
            <button
              type="button"
              onClick={() => void hide(p.id)}
              aria-label={t('profile.suggest.hide')}
              className="absolute right-1 top-1 h-7 w-7 text-[12px] text-white/50"
            >
              ✕
            </button>
            <Link
              href={p.handle ? `/@${p.handle}` : `/creator/${p.id}`}
              className="flex flex-col items-center gap-1"
            >
              <Avatar name={p.displayName} url={p.avatarUrl} className="h-14 w-14 text-[18px]" />
              <span className="w-full truncate text-[13px] font-bold">{p.displayName}</span>
            </Link>
            <span className="text-[11px] text-white/50">
              {p.mutual ? t('profile.suggest.mutual', { count: p.mutual }) : t('profile.suggest.popular')}
            </span>
            <button
              type="button"
              onClick={() => void follow(p.id)}
              className={`mt-1 h-8 w-full rounded-full text-[12px] font-black ${followed.includes(p.id) ? 'bg-white/10' : 'bg-brand text-white'}`}
              data-testid="suggest-follow"
            >
              {followed.includes(p.id) ? t('profile.suggest.following') : t('profile.suggest.follow')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
