'use client';

import { Heart, MessageCircle, Phone, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useMe } from '@/components/MeProvider';
import { toast } from '@/components/ui/Toast';
import { Sheet } from '@/components/video/Sheet';
import { ShareSheet } from '@/components/video/ShareSheet';
import { useLang, useT } from '@/i18n/client';

type Stat = {
  id: 'followers' | 'hearts' | 'following' | 'products' | 'sold' | 'videos' | 'likes';
  value: number;
  href?: string; // bấm vào số để mở danh sách (Người theo dõi / Đang theo dõi)
};

// Hàng số liệu + hàng nút của trang Kiot / trang creator kiểu V4. Số Followers và Tim đổi ngay khi bấm;
// máy chủ trả số thật sau mỗi lần bấm.
export function ProfileActions({
  target,
  stats,
  initial,
  isSelf,
  selfLink,
  phone,
  share,
  loginHref,
  children,
}: {
  target: { kiotId: string } | { userId: string };
  stats: Stat[];
  initial: { following: boolean; hearted?: boolean };
  isSelf: boolean;
  selfLink?: { href: string; label: string };
  phone?: string;
  share: { url: string; title: string; heading: string; qrHint: string };
  loginHref: string;
  children?: React.ReactNode; // giới thiệu, địa chỉ… nằm giữa hàng số liệu và hàng nút (như V4)
}) {
  const t = useT();
  const lang = useLang();
  const { me } = useMe();
  const [values, setValues] = useState(() => Object.fromEntries(stats.map((s) => [s.id, s.value])));
  const [following, setFollowing] = useState(initial.following);
  const [hearted, setHearted] = useState(Boolean(initial.hearted));
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'message' | 'share' | null>(null);
  const kiotId = 'kiotId' in target ? target.kiotId : null;
  const fmt = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 });

  function needLogin() {
    if (me) return false;
    window.location.href = loginHref;
    return true;
  }

  async function post(url: string, body: object) {
    setBusy(true);
    try {
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 401) {
        window.location.href = loginHref;
        return null;
      }
      return (await res.json()) as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  }

  function limitToast(limit: unknown) {
    toast(t('profile.freeLimit', { limit: Number(limit) || 50 }), {
      href: '/kiot-cua-toi/tao',
      label: t('profile.openKiot'),
    });
  }

  async function follow() {
    if (busy || needLogin()) return;
    const data = await post('/api/social/follow', target);
    if (!data) return;
    if (data.ok) {
      setFollowing(Boolean(data.following));
      setValues((v) => ({ ...v, followers: Number(data.followers) }));
    } else if (data.error === 'FREE_LIMIT') limitToast(data.limit);
  }

  async function heart() {
    if (!kiotId || busy || needLogin()) return;
    const data = await post('/api/social/kiot-heart', { kiotId });
    if (!data) return;
    if (data.ok) {
      setHearted(Boolean(data.hearted));
      setValues((v) => ({ ...v, hearts: Number(data.hearts) }));
    } else if (data.error === 'FREE_LIMIT') limitToast(data.limit);
  }

  const square = 'grid h-11 w-11 shrink-0 place-items-center rounded-[12px]';
  const local = phone ? '0' + phone.replace(/^\+84/, '') : '';
  return (
    <>
      <dl className="mt-4 flex gap-6 text-center" data-testid="profile-stats">
        {stats.map((s) => {
          const cell = (
            <>
              <dt className="text-[11px] text-white/50">{t(`profile.stat.${s.id}`)}</dt>
              <dd className="text-[17px] font-black" data-testid={`stat-${s.id}`}>
                {fmt.format(values[s.id] ?? 0)}
              </dd>
            </>
          );
          return s.href ? (
            <Link key={s.id} href={s.href} className="flex flex-col-reverse" data-testid={`stat-link-${s.id}`}>
              {cell}
            </Link>
          ) : (
            <div key={s.id} className="flex flex-col-reverse">
              {cell}
            </div>
          );
        })}
      </dl>
      {children}
      <div className="mt-4 flex gap-2">
        {isSelf ? (
          selfLink ? (
            <Link
              href={selfLink.href}
              className="flex h-11 flex-1 items-center justify-center rounded-[12px] bg-white/10 text-[14px] font-black"
            >
              {selfLink.label}
            </Link>
          ) : null
        ) : (
          <button
            type="button"
            onClick={() => void follow()}
            aria-pressed={following}
            disabled={busy}
            className={`h-11 flex-1 rounded-[12px] text-[14px] font-black ${following ? 'bg-zinc-600' : 'bg-brand'}`}
            data-testid="profile-follow"
          >
            {following ? t('profile.following') : t('profile.follow')}
          </button>
        )}
        {phone ? (
          <button
            type="button"
            onClick={() => setSheet('message')}
            aria-label={t('profile.message')}
            className={`${square} bg-white/10`}
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {kiotId && !isSelf ? (
          <button
            type="button"
            onClick={() => void heart()}
            aria-label={t('profile.heart')}
            aria-pressed={hearted}
            disabled={busy}
            className={`${square} ${hearted ? 'bg-brand' : 'bg-white/10'}`}
            data-testid="profile-heart"
          >
            <Heart className={`h-5 w-5 ${hearted ? 'fill-white' : ''}`} aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSheet('share')}
          aria-label={t('profile.share')}
          className={`${square} bg-white/10`}
        >
          <Share2 className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <Sheet open={sheet === 'message'} onClose={() => setSheet(null)} title={t('profile.messageTitle')}>
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://zalo.me/${local}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#0068FF] font-black text-white"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Zalo
          </a>
          <a
            href={`tel:${phone}`}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-black font-black text-white"
          >
            <Phone className="h-4 w-4" aria-hidden /> {t('profile.call')}
          </a>
        </div>
      </Sheet>
      {sheet === 'share' ? (
        <ShareSheet
          url={share.url}
          title={share.title}
          heading={share.heading}
          qrHint={share.qrHint}
          onClose={() => setSheet(null)}
          onCopied={() => toast(t('profile.copied'))}
        />
      ) : null}
    </>
  );
}
