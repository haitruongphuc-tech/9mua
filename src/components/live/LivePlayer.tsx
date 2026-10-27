'use client';

import { Eye, Flag, Heart, Pin, Send, Share2, Volume2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { addLiveToCartAction } from '@/app/live/actions';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { OPEN_SIGNUP_EVENT } from '@/components/SignupPopup';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/messages';
import { formatVnd } from '@/lib/format';
import type { ChatLine, LiveState, LiveView } from '@/modules/live';
import { play, type MediaSession } from './webrtc';

type LiveData = Extract<LiveView, { kind: 'live' }>;

const HEARTBEAT_MS = 20_000;
const CONNECT_TIMEOUT_MS = 15_000;
const REPORT_REASONS = ['bad_content', 'scam', 'copyright', 'other'] as const;

// Một buổi live trên màn hình người xem (SPEC-live.md mục 4–7, giao diện V4 trang 03). Chỉ buổi đang hiện (active)
// mới kết nối hình, gửi tín hiệu "đang xem" và nghe chat — vuốt sang buổi khác thì ngắt.
export function LivePlayer({
  view,
  active,
  loggedIn,
}: {
  view: LiveData;
  active: boolean;
  loggedIn: boolean;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [phase, setPhase] = useState<'connecting' | 'waiting' | 'playing' | 'ended' | 'full'>('connecting');
  const [viewers, setViewers] = useState(view.viewers);
  const [hearts, setHearts] = useState(view.hearts);
  const [pinned, setPinned] = useState(view.pinned);
  const [chat, setChat] = useState<ChatLine[]>(view.chat);
  const [hidden, setHidden] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [flying, setFlying] = useState<number[]>([]);
  const [reporting, setReporting] = useState(false);
  const [adding, startAdding] = useTransition();
  const pendingHearts = useRef(0);
  const chatBox = useRef<HTMLDivElement>(null);
  const lastChatId = useRef<string | null>(view.chat.at(-1)?.id ?? null);

  const askLogin = useCallback(() => {
    window.dispatchEvent(new Event(OPEN_SIGNUP_EVENT));
  }, []);

  // Kết nối hình (WHEP). Người phát chưa có hình thì chờ và thử lại mỗi 3 giây; rớt mạng thì tự nối lại.
  useEffect(() => {
    if (!active) return;
    let session: MediaSession | null = null;
    let stopped = false;
    // Báo 1 lần mỗi lượt xem: kết nối được hình hay không (CEO xem tỉ lệ lỗi ở /admin/live để quyết thêm TURN).
    let reported: boolean | null = null;
    const report = (ok: boolean) => {
      if (reported === true || reported === ok) return;
      reported = ok;
      void fetch(`/api/live/${view.id}/connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ok }),
      }).catch(() => {});
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const retry = () => {
      if (!stopped) timer = setTimeout(connect, 3_000);
    };
    async function connect() {
      const res = await fetch(`/api/live/${view.id}/token`, { cache: 'no-store' }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as {
        kind: string;
        status?: string;
        whepUrl?: string;
        viewToken?: string;
      } | null;
      if (stopped) return;
      if (data?.kind === 'ended') return setPhase('ended');
      if (data?.kind === 'full') return setPhase('full');
      if (!data?.whepUrl || !data.viewToken) return retry();
      if (data.status !== 'live') {
        setPhase('waiting');
        return retry();
      }
      try {
        await session?.close();
        const current = await play(data.whepUrl, data.viewToken, videoRef.current!);
        session = current;
        current.pc.addEventListener('connectionstatechange', () => {
          const state = current.pc.connectionState;
          if (!current.fake && state === 'connected') report(true);
          if (!current.fake && state === 'failed') report(false);
          if (session === current && ['failed', 'disconnected'].includes(state)) retry();
        });
        setTimeout(() => {
          if (!stopped && !current.fake && current.pc.connectionState !== 'connected') report(false);
        }, CONNECT_TIMEOUT_MS);
        setPhase('playing');
        void videoRef.current?.play().catch(() => {});
      } catch {
        retry();
      }
    }
    void connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      void session?.close();
    };
  }, [active, view.id]);

  // Tín hiệu "đang xem" mỗi 20 giây khi đang phát và tab đang mở (đếm người xem thật).
  useEffect(() => {
    if (!active || phase !== 'playing') return;
    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await fetch(`/api/live/${view.id}/heartbeat`, { method: 'POST' }).catch(() => null);
      const d = (await res?.json().catch(() => null)) as { viewers?: number; ended?: boolean } | null;
      if (d?.ended) setPhase('ended');
      else if (typeof d?.viewers === 'number') setViewers(d.viewers);
    };
    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [active, phase, view.id]);

  // Chat, tim, số người xem, sản phẩm ghim qua SSE. Lỗi liên tục thì chuyển sang hỏi lại mỗi 3 giây.
  useEffect(() => {
    if (!active) return;
    const onChat = (lines: ChatLine[]) =>
      setChat((old) => {
        const ids = new Set(old.map((l) => l.id));
        const next = [...old, ...lines.filter((l) => !ids.has(l.id))].slice(-50);
        lastChatId.current = next.at(-1)?.id ?? lastChatId.current;
        return next;
      });
    const onState = (s: LiveState) => {
      setViewers(s.viewers);
      setHearts((h) => Math.max(h, s.hearts));
      setPinned(s.pinned);
      setHidden(s.hiddenIds);
      if (s.status === 'ended' || s.status === 'stopped') setPhase('ended');
    };
    let poll: ReturnType<typeof setInterval> | undefined;
    let errors = 0;
    const url = () =>
      `/api/live/${view.id}/events${lastChatId.current ? `?after=${lastChatId.current}` : ''}`;
    const es = new EventSource(url());
    es.addEventListener('chat', (e) => onChat(JSON.parse((e as MessageEvent).data) as ChatLine[]));
    es.addEventListener('state', (e) => onState(JSON.parse((e as MessageEvent).data) as LiveState));
    es.onerror = () => {
      errors += 1;
      if (errors < 3 || poll) return;
      es.close();
      poll = setInterval(async () => {
        const sep = url().includes('?') ? '&' : '?';
        const res = await fetch(`${url()}${sep}poll=1`, { cache: 'no-store' }).catch(() => null);
        const d = (await res?.json().catch(() => null)) as { chat: ChatLine[]; state: LiveState } | null;
        if (!d) return;
        if (d.chat.length) onChat(d.chat);
        onState(d.state);
      }, 3_000);
    };
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [active, view.id]);

  useEffect(() => {
    chatBox.current?.scrollTo({ top: chatBox.current.scrollHeight });
  }, [chat]);

  // Gom tim gửi 1 lần mỗi giây (máy chủ giới hạn 10 tim/giây mỗi người).
  useEffect(() => {
    if (!active || !loggedIn) return;
    const timer = setInterval(async () => {
      const count = pendingHearts.current;
      if (!count) return;
      pendingHearts.current = 0;
      const res = await fetch(`/api/live/${view.id}/hearts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ count }),
      }).catch(() => null);
      const d = (await res?.json().catch(() => null)) as { hearts?: number } | null;
      if (typeof d?.hearts === 'number') setHearts((h) => Math.max(h, d.hearts!));
    }, 1_000);
    return () => clearInterval(timer);
  }, [active, loggedIn, view.id]);

  const heart = () => {
    if (!loggedIn) return askLogin();
    pendingHearts.current += 1;
    setHearts((h) => h + 1);
    const id = Date.now() + Math.random();
    setFlying((f) => [...f, id]);
    setTimeout(() => setFlying((f) => f.filter((x) => x !== id)), 1_200);
  };

  const send = async () => {
    if (!loggedIn) return askLogin();
    const message = text.trim();
    if (!message) return;
    const res = await fetch(`/api/live/${view.id}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: message }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res?.status === 401) return askLogin();
    if (d?.ok) setText('');
    else toast(d?.error ?? t('live.addFailed'));
  };

  const share = async () => {
    const url = `${window.location.origin}/live/${view.id}`;
    if (navigator.share) await navigator.share({ title: view.title, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast(t('live.shared'));
    }
  };

  const report = async (reason: (typeof REPORT_REASONS)[number]) => {
    setReporting(false);
    if (!loggedIn) return askLogin();
    await fetch(`/api/live/${view.id}/report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    toast(t('live.report.sent'));
  };

  const addToCart = () =>
    startAdding(async () => {
      if (!pinned) return;
      const r = await addLiveToCartAction(view.id, pinned.id);
      if (!r.ok && r.login) {
        askLogin();
        return;
      }
      toast(r.message, r.ok ? { href: '/gio-hang', label: t('shop.cart.title') } : undefined);
      if (r.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
    });

  const visibleChat = chat.filter((c) => !hidden.includes(c.id));
  const initial = (view.host.kiot?.name ?? view.host.displayName).trim().charAt(0).toUpperCase();

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" data-testid="live-player">
      <video
        ref={videoRef}
        muted={muted}
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        data-testid="live-video"
        onClick={() => setMuted(false)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/40" />

      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
        <a
          href={view.host.href}
          className="flex min-w-0 items-center gap-2 rounded-full bg-black/50 py-0.5 pl-0.5 pr-3"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-red-500 bg-brand font-black">
            {view.host.kiot?.logoUrl ? (
              <Image
                src={view.host.kiot.logoUrl}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
                unoptimized
              />
            ) : (
              initial
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-bold">
              {view.host.kiot?.name ?? view.host.displayName}
            </span>
            <span className="block truncate text-[10px] text-white/70">{view.title}</span>
          </span>
        </a>
        <span
          className="flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black"
          data-testid="live-viewers"
        >
          <Eye className="h-3 w-3" aria-hidden /> {t('live.badge')} · {t('live.viewers', { count: viewers })}
        </span>
      </div>

      {pinned ? (
        <div
          className="absolute left-3 top-16 flex w-[240px] items-center gap-2 rounded-[14px] bg-white p-2 text-black shadow-xl"
          data-testid="live-pinned"
        >
          <a
            href={pinned.url}
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-zinc-100"
          >
            {pinned.imageUrl ? (
              <Image src={pinned.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
            ) : null}
          </a>
          <a href={pinned.url} className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[10px] font-bold text-brand">
              <Pin className="h-3 w-3" aria-hidden /> {t('live.pinned')}
            </span>
            <span className="block truncate text-[12px] font-bold">{pinned.name}</span>
            <span className="block text-[12px] font-black">{formatVnd(pinned.price)}</span>
          </a>
          <button
            type="button"
            onClick={addToCart}
            disabled={adding}
            className="h-8 shrink-0 rounded-full bg-brand px-2.5 text-[11px] font-black text-white disabled:opacity-60"
            data-testid="live-add-cart"
          >
            {t('live.addToCart')}
          </button>
        </div>
      ) : null}

      {phase !== 'playing' && phase !== 'ended' && phase !== 'full' ? (
        <p className="absolute inset-x-0 top-1/2 text-center text-[13px] font-bold text-white/80">
          {t(phase === 'waiting' ? 'live.waiting' : 'live.connecting')}
        </p>
      ) : null}
      {phase === 'playing' && muted ? (
        <button
          type="button"
          onClick={() => setMuted(false)}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-bold"
        >
          <Volume2 className="h-4 w-4" aria-hidden /> {t('live.tapSound')}
        </button>
      ) : null}

      <div
        ref={chatBox}
        className="no-scrollbar absolute bottom-[72px] left-3 max-h-[200px] w-[70%] space-y-1.5 overflow-y-auto"
        data-testid="live-chat"
      >
        {visibleChat.map((c) => (
          <p key={c.id} className="w-fit max-w-full rounded-[12px] bg-black/40 px-2.5 py-1 text-[12px]">
            <b className="text-[#FFB27A]">
              {c.name}
              {c.host ? ` · ${t('live.host')}` : ''}:
            </b>{' '}
            {c.text}
          </p>
        ))}
      </div>

      <div className="absolute bottom-[72px] right-3 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={share}
          aria-label={t('live.share')}
          className="grid h-11 w-11 place-items-center rounded-full bg-black/50"
        >
          <Share2 className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setReporting(true)}
          aria-label={t('live.report')}
          className="grid h-11 w-11 place-items-center rounded-full bg-black/50"
          data-testid="live-report"
        >
          <Flag className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-[11px] font-bold" data-testid="live-hearts">
          {hearts.toLocaleString('vi-VN')}
        </span>
      </div>
      {flying.map((h) => (
        <Heart
          key={h}
          className="pointer-events-none absolute bottom-24 right-6 h-8 w-8 fill-brand text-brand"
          style={{ animation: 'heartFly 1.2s ease-out forwards' }}
          aria-hidden
        />
      ))}

      <div className="absolute bottom-3 left-3 right-3 flex gap-2">
        {loggedIn ? (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            maxLength={150}
            placeholder={t('live.chat.placeholder')}
            aria-label={t('live.chat.placeholder')}
            className="h-11 min-w-0 flex-1 rounded-full border border-white/20 bg-black/50 px-4 text-[13px] text-white outline-none focus:border-brand"
            data-testid="live-chat-input"
          />
        ) : (
          <button
            type="button"
            onClick={askLogin}
            className="h-11 min-w-0 flex-1 truncate rounded-full border border-white/20 bg-black/50 px-4 text-left text-[13px] text-white/70"
          >
            {t('live.chat.login')}
          </button>
        )}
        {loggedIn ? (
          <button
            type="button"
            onClick={() => void send()}
            aria-label={t('live.chat.send')}
            className="grid h-11 w-11 place-items-center rounded-full bg-white/15"
            data-testid="live-chat-send"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          onClick={heart}
          aria-label={t('live.heart')}
          className="grid h-11 w-11 place-items-center rounded-full bg-brand shadow-[0_0_14px_#ff6b00]"
          data-testid="live-heart"
        >
          <Heart className="h-5 w-5 fill-white" aria-hidden />
        </button>
      </div>

      {reporting ? (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60" onClick={() => setReporting(false)}>
          <div
            className="w-full rounded-t-[20px] border-t border-white/10 bg-ink p-4"
            style={{ animation: 'sheetUp 0.2s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-black">{t('live.report.title')}</p>
            <div className="mt-3 grid gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => void report(r)}
                  className="h-11 rounded-full border border-white/15 bg-white/5 text-[13px] font-bold"
                >
                  {t(`live.report.${r}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'ended' || phase === 'full' ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center"
          data-testid="live-ended"
        >
          <p className="text-[18px] font-black">
            {t(phase === 'ended' ? 'live.ended.title' : 'live.full.title')}
          </p>
          {phase === 'ended' ? (
            <a
              href={view.host.href}
              className="h-10 rounded-full bg-brand px-5 text-[13px] font-black leading-10"
            >
              {t('live.ended.host', { name: view.host.kiot?.name ?? view.host.displayName })}
            </a>
          ) : (
            <Link href="/live" className="h-10 rounded-full bg-brand px-5 text-[13px] font-black leading-10">
              {t('live.full.other')}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
