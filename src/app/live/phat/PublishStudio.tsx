'use client';

import { Eye, Heart, Mic, MicOff, Pin, Radio, RefreshCcw, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { PickableProduct } from '@/app/api/video/products/route';
import { cameraConstraints, publish, type MediaSession } from '@/components/live/webrtc';
import { toast } from '@/components/ui/Toast';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { ChatLine, LiveState } from '@/modules/live';
import { banChatAction, endLiveAction, hideChatAction, pinAction, startLiveAction } from '../actions';

type Summary = { durationSec: number; peakViewers: number; hearts: number } | null;
type Pinned = Pick<PickableProduct, 'id' | 'name' | 'price' | 'thumbUrl'> | null;

const field =
  'h-12 w-full rounded-full border border-white/15 bg-black/40 px-4 text-[14px] text-white outline-none focus:border-brand';

function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`;
}

// Phát live từ trình duyệt điện thoại (SPEC-live.md mục 3).
export function PublishStudio({ openLiveId, maxMinutes }: { openLiveId: string | null; maxMinutes: number }) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [micOn, setMicOn] = useState(true);
  const [title, setTitle] = useState('');
  const [pinned, setPinned] = useState<Pinned>(null);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PickableProduct[]>([]);
  const [phase, setPhase] = useState<'setup' | 'live' | 'summary'>('setup');
  const [liveId, setLiveId] = useState<string | null>(null);
  const [status, setStatus] = useState('created');
  const [viewers, setViewers] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [summary, setSummary] = useState<Summary>(null);
  const [leftover, setLeftover] = useState(openLiveId);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const session = useRef<MediaSession | null>(null);
  const creds = useRef<{ url: string; token: string } | null>(null);
  const liveSince = useRef<number | null>(null);
  const warned = useRef(false);

  async function openCamera(face = facing) {
    try {
      const s = await navigator.mediaDevices.getUserMedia(cameraConstraints(face));
      stream?.getTracks().forEach((tr) => tr.stop());
      setStream(s);
      setCameraError(false);
      if (videoRef.current) videoRef.current.srcObject = s;
      return s;
    } catch {
      setCameraError(true);
      return null;
    }
  }

  useEffect(() => {
    void openCamera();
    return () => stream?.getTracks().forEach((tr) => tr.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ mở camera 1 lần khi vào trang
  }, []);

  // Tìm sản phẩm để ghim: dùng chung API chọn sản phẩm của trang đăng video (Kiot của mình lên trước).
  useEffect(() => {
    if (!picker) return;
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/video/products?q=${encodeURIComponent(q)}`).catch(() => null);
      const d = (await res?.json().catch(() => null)) as { items?: PickableProduct[] } | null;
      setFound(d?.items ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [picker, q]);

  // Giữ màn hình sáng khi đang live (trình duyệt hỗ trợ Wake Lock).
  useEffect(() => {
    if (phase !== 'live' || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    void navigator.wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [phase]);

  // Trạng thái, số người xem, tim, chat qua SSE.
  useEffect(() => {
    if (phase !== 'live' || !liveId) return;
    const es = new EventSource(`/api/live/${liveId}/events`);
    es.addEventListener('chat', (e) => {
      const lines = JSON.parse((e as MessageEvent).data) as ChatLine[];
      setChat((old) => {
        const ids = new Set(old.map((l) => l.id));
        return [...old, ...lines.filter((l) => !ids.has(l.id))].slice(-50);
      });
    });
    es.addEventListener('state', (e) => {
      const s = JSON.parse((e as MessageEvent).data) as LiveState;
      setStatus(s.status);
      setViewers(s.viewers);
      setHearts(s.hearts);
      setHidden(s.hiddenIds);
      if (s.status === 'live' && !liveSince.current) liveSince.current = Date.now();
      if (s.status === 'ended' || s.status === 'stopped') void finish();
    });
    const timer = setInterval(() => {
      if (!liveSince.current || warned.current) return;
      if (Date.now() - liveSince.current >= (maxMinutes - 5) * 60_000) {
        warned.current = true;
        toast(t('live.publish.fiveMin'));
      }
    }, 10_000);
    return () => {
      es.close();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish đọc ref, không cần kết nối lại
  }, [phase, liveId, maxMinutes, t]);

  async function connect(url: string, token: string, s: MediaStream) {
    await session.current?.close().catch(() => {});
    session.current = await publish(url, token, s);
    session.current.pc.addEventListener('connectionstatechange', () => {
      const st = session.current?.pc.connectionState;
      if (st === 'failed' || st === 'disconnected') {
        setReconnecting(true);
        setTimeout(() => void reconnect(), 3_000);
      } else if (st === 'connected') setReconnecting(false);
    });
  }

  async function reconnect() {
    if (!creds.current || !stream) return;
    try {
      await connect(creds.current.url, creds.current.token, stream);
    } catch {
      setTimeout(() => void reconnect(), 3_000);
    }
  }

  const start = () =>
    startBusy(async () => {
      setError(null);
      const s = stream ?? (await openCamera());
      if (!s) return;
      const r = await startLiveAction({ title, pinProductId: pinned?.id ?? null });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      creds.current = { url: r.whipUrl, token: r.publishToken };
      setLiveId(r.liveId);
      try {
        await connect(r.whipUrl, r.publishToken, s);
        setPhase('live');
      } catch {
        setError(t('live.publish.err.media'));
        await endLiveAction(r.liveId);
      }
    });

  async function finish() {
    if (!liveId) return;
    await session.current?.close().catch(() => {});
    session.current = null;
    const s = await endLiveAction(liveId);
    setSummary(s ? { durationSec: s.durationSec, peakViewers: s.peakViewers, hearts: s.hearts } : null);
    setPhase('summary');
  }

  const end = () => {
    if (!window.confirm(t('live.publish.endConfirm'))) return;
    startBusy(finish);
  };

  async function flip() {
    const next = facing === 'user' ? 'environment' : 'user';
    const s = await navigator.mediaDevices
      .getUserMedia({ video: cameraConstraints(next).video })
      .catch(() => null);
    const track = s?.getVideoTracks()[0];
    if (!track || !stream) return;
    const sender = session.current?.pc.getSenders().find((x) => x.track?.kind === 'video');
    await sender?.replaceTrack(track);
    stream.getVideoTracks().forEach((tr) => {
      stream.removeTrack(tr);
      tr.stop();
    });
    stream.addTrack(track);
    if (videoRef.current) videoRef.current.srcObject = stream;
    setFacing(next);
  }

  function toggleMic() {
    stream?.getAudioTracks().forEach((tr) => (tr.enabled = !micOn));
    setMicOn(!micOn);
  }

  const choose = (p: Pinned) =>
    startBusy(async () => {
      setPicker(false);
      if (phase === 'live' && liveId) {
        const r = await pinAction(liveId, p?.id ?? null);
        if (!r.ok) return toast(t('live.publish.err.INVALID_INPUT'));
      }
      setPinned(p);
    });

  const visibleChat = chat.filter((c) => !hidden.includes(c.id));

  if (phase === 'summary') {
    return (
      <section className="rounded-[24px] border border-white/10 bg-white/5 p-5" data-testid="publish-summary">
        <h1 className="font-display text-[22px] font-black">{t('live.publish.summary')}</h1>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            [t('live.publish.duration'), duration(summary?.durationSec ?? 0)],
            [t('live.publish.peak'), String(summary?.peakViewers ?? 0)],
            [t('live.publish.hearts'), (summary?.hearts ?? 0).toLocaleString('vi-VN')],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[14px] bg-black/40 p-3">
              <dt className="text-[11px] text-white/60">{k}</dt>
              <dd className="mt-1 text-[18px] font-black">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[12px] text-white/70">{t('live.publish.xuNote')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-12 w-full rounded-full bg-brand text-[14px] font-black"
        >
          {t('live.publish.again')}
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {leftover && phase === 'setup' ? (
        <div className="flex items-center gap-3 rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300">
          <span className="flex-1">{t('live.publish.err.ALREADY_LIVE')}</span>
          <button
            type="button"
            onClick={() =>
              startBusy(async () => {
                await endLiveAction(leftover);
                setLeftover(null);
              })
            }
            className="h-9 rounded-full bg-red-600 px-4 text-white"
          >
            {t('live.publish.end')}
          </button>
        </div>
      ) : null}

      <div className="relative mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-[20px] border border-white/10 bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-[13px] text-red-300">{t('live.publish.cameraDenied')}</p>
            <button
              type="button"
              onClick={() => void openCamera()}
              className="h-10 rounded-full bg-brand px-4 text-[13px] font-black"
            >
              {t('live.publish.camera')}
            </button>
          </div>
        ) : null}
        {phase === 'live' ? (
          <>
            <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
              <span
                className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black"
                data-testid="publish-status"
              >
                {status === 'live' ? t('live.publish.live') : t('live.connecting')}
              </span>
              <span className="flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold">
                <span className="flex items-center gap-1" data-testid="publish-viewers">
                  <Eye className="h-3 w-3" aria-hidden /> {viewers}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" aria-hidden /> {hearts}
                </span>
              </span>
            </div>
            {reconnecting ? (
              <p className="absolute inset-x-3 top-12 rounded-[12px] bg-black/70 px-3 py-2 text-center text-[12px]">
                {t('live.publish.reconnecting')}
              </p>
            ) : null}
            <div
              className="no-scrollbar absolute bottom-16 left-3 max-h-[220px] w-[80%] space-y-1.5 overflow-y-auto"
              data-testid="publish-chat"
            >
              {visibleChat.map((c) => (
                <div
                  key={c.id}
                  className="w-fit max-w-full rounded-[12px] bg-black/50 px-2.5 py-1 text-[12px]"
                >
                  <b className="text-[#FFB27A]">{c.name}:</b> {c.text}
                  {c.host ? null : (
                    <span className="ml-2 inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => void hideChatAction(c.id).then(() => setHidden((h) => [...h, c.id]))}
                        className="rounded-full bg-white/15 px-1.5 text-[10px]"
                        data-testid="publish-hide"
                      >
                        {t('live.chat.hide')}
                      </button>
                      <button
                        type="button"
                        onClick={() => liveId && void banChatAction(liveId, c.userId)}
                        className="rounded-full bg-red-600/70 px-1.5 text-[10px]"
                      >
                        {t('live.chat.ban')}
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
              <button
                type="button"
                onClick={() => void flip()}
                aria-label={t('live.publish.flip')}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/60"
              >
                <RefreshCcw className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={micOn ? t('live.publish.mute') : t('live.publish.unmute')}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/60"
              >
                {micOn ? (
                  <Mic className="h-5 w-5" aria-hidden />
                ) : (
                  <MicOff className="h-5 w-5 text-red-400" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => setPicker(true)}
                aria-label={t('live.publish.pin')}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/60"
              >
                <Pin className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={end}
                disabled={busy}
                className="h-11 flex-1 rounded-full bg-red-600 text-[14px] font-black"
                data-testid="publish-end"
              >
                {t('live.publish.end')}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {phase === 'setup' ? (
        <section className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-gradient-to-br from-red-600/30 via-brand/20 to-fuchsia-700/30 p-5">
          <h1 className="flex items-center gap-2 font-display text-[22px] font-black">
            <Radio className="h-6 w-6 text-red-400" aria-hidden /> {t('live.publish.title')}
          </h1>
          <p className="text-[13px] text-white/75">{t('live.publish.lead')}</p>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t('live.publish.titleLabel')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={t('live.publish.titlePlaceholder')}
              className={field}
              data-testid="publish-title"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold">{t('live.publish.pin')}</span>
            {pinned ? (
              <span
                className="flex min-w-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[12px]"
                data-testid="publish-pinned"
              >
                <span className="truncate">{pinned.name}</span>
                <button type="button" onClick={() => setPinned(null)} aria-label={t('live.publish.noPin')}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPicker(true)}
                className="h-8 rounded-full border border-white/20 px-3.5 text-[12px] font-bold"
                data-testid="publish-pick"
              >
                + {t('live.pinned')}
              </button>
            )}
          </div>
          {error ? (
            <p role="alert" className="text-[13px] font-bold text-red-300" data-testid="publish-error">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={start}
            disabled={busy || !stream}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-black shadow-[0_0_20px_rgb(255_107_0/0.5)] disabled:opacity-60"
            data-testid="publish-start"
          >
            <Radio className="h-5 w-5" aria-hidden />{' '}
            {busy ? t('live.publish.starting') : t('live.publish.start')}
          </button>
        </section>
      ) : null}

      {picker ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60"
          onClick={() => setPicker(false)}
        >
          <div
            className="max-h-[70dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] border-t border-white/10 bg-ink p-4"
            style={{ animation: 'sheetUp 0.2s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <label className="relative block">
              <Search
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
                aria-hidden
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('live.publish.search')}
                className={`${field} pl-10`}
                data-testid="publish-pin-search"
              />
            </label>
            <ul className="mt-3 flex flex-col gap-2">
              <li>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="h-10 w-full rounded-[12px] bg-white/5 text-[13px] font-bold"
                >
                  {t('live.publish.noPin')}
                </button>
              </li>
              {found.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => choose(p)}
                    className="flex w-full items-center gap-2 rounded-[12px] bg-white/5 p-2 text-left"
                    data-testid="publish-pin-option"
                  >
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-white/10">
                      {p.thumbUrl ? (
                        <Image
                          src={p.thumbUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">{p.name}</span>
                      <span className="block text-[12px] text-brand">{formatVnd(p.price)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
