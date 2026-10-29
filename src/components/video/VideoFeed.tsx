'use client';

import {
  Bookmark,
  Eye,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share2,
  ShoppingBag,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LivePlayer } from '@/components/live/LivePlayer';
import { ME_CHANGED_EVENT, useMe } from '@/components/MeProvider';
import { addToCartAction } from '@/components/orders/add-to-cart-action';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { LiveView } from '@/modules/live';
import type { SocialFeedVideo } from '@/modules/social';
import { CommentsSheet } from './CommentsSheet';
import { interleaveLives } from './interleave';
import { ShareSheet } from './ShareSheet';
import { Sheet } from './Sheet';

type ViewEntry = { videoId: string; watchedSeconds: number };
type Tab = 'for-you' | 'following';
type LiveData = Extract<LiveView, { kind: 'live' }>;

const REPORT_REASONS = ['noi_dung_xau', 'lua_dao', 'ban_quyen', 'khac'] as const;
const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));

// Feed video dọc toàn màn hình theo V4 (SPEC-creator.md mục 3 + bổ sung 27/10): vuốt lên/xuống, tự phát tắt
// tiếng, chạm 1 lần bật/tắt tiếng, chạm 2 lần thả tim (túi cam bay lên), thanh tiến độ, cột nút V4, bình luận,
// chia sẻ có QR, tab Đang Follow / Dành cho bạn (trang chủ).
// Safari iPhone kéo khung snap về video cũ nếu cấu trúc trang đổi giữa lúc đang vuốt (WebKit bug 173830):
// không thêm/bớt phần tử trong các video khi đổi video đang xem (chỉ đổi class), và chỉ nối thêm video tải về
// sau khi ngón tay đã dừng vuốt. Hiệu ứng túi cam và các bảng trượt gắn vào <body>, ngoài khung snap.
// variant "page" (/v/<id>): toàn màn hình, có nút ✕. "home" (trang chủ, menu Video): nằm giữa header và thanh dưới,
// chỉ tải trước video đang xem để tiết kiệm 4G.
export function VideoFeed({
  initial,
  nextCursor,
  appUrl,
  variant = 'page',
  lives = [],
  loggedIn = false,
  header,
}: {
  initial: SocialFeedVideo[];
  nextCursor: string | null;
  appUrl: string;
  variant?: 'page' | 'home';
  lives?: LiveData[];
  loggedIn?: boolean;
  header?: ReactNode; // hàng Story/live trên cùng (trang chủ)
}) {
  const t = useT();
  const { me } = useMe();
  const home = variant === 'home';
  const [tab, setTab] = useState<Tab>('for-you');
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [toast, setToast] = useState<{ text: string; kiotLink?: boolean } | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'comments' | 'share' | 'more'; video: SocialFeedVideo } | null>(
    null,
  );
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const watched = useRef(new Map<string, number>());
  const queue = useRef<ViewEntry[]>([]);
  const loading = useRef(false);
  const scrolling = useRef(false);
  const scrollIdle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingAppend = useRef<(() => void) | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef(0);
  const entries = useMemo(
    () => (tab === 'for-you' ? interleaveLives(items, lives, !cursor) : interleaveLives(items, [], true)),
    [items, lives, cursor, tab],
  );
  const activeEntry = entries[active];
  const activeVideoId = activeEntry?.kind === 'video' ? activeEntry.video.id : undefined;

  const loginHref = (videoId?: string) =>
    `/dang-nhap?next=${encodeURIComponent(videoId ? `/v/${videoId}` : '/')}`;
  const requireLogin = (videoId?: string) => {
    if (me) return false;
    window.location.href = loginHref(videoId);
    return true;
  };

  const flush = useCallback(() => {
    if (queue.current.length === 0) return;
    const body = JSON.stringify(queue.current.splice(0));
    if (!navigator.sendBeacon?.('/api/video/views', new Blob([body], { type: 'application/json' })))
      void fetch('/api/video/views', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
  }, []);

  // Video nào chiếm ≥ 60% màn hình là video đang xem.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { threshold: 0.6 },
    );
    document.querySelectorAll('[data-feed-item]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries.length]);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) void v.play().catch(() => {});
      else v.pause();
    });
    // Rời video trước: ghi lại thời gian đã xem vào hàng chờ.
    for (const [videoId, seconds] of watched.current)
      if (videoId !== activeVideoId && seconds > 0) {
        queue.current.push({ videoId, watchedSeconds: seconds });
        watched.current.delete(videoId);
      }
    if (queue.current.length >= 5) flush();
    if (cursor && !loading.current && active >= entries.length - 3) {
      loading.current = true;
      fetch(`/api/video/feed?tab=${tab}&sau=${encodeURIComponent(cursor)}`)
        .then((r) => r.json())
        .then((page: { items: SocialFeedVideo[]; nextCursor: string | null }) => {
          const append = () => {
            setItems((list) => [...list, ...page.items.filter((v) => !list.some((x) => x.id === v.id))]);
            setCursor(page.items.length ? page.nextCursor : null);
            loading.current = false;
          };
          if (scrolling.current) pendingAppend.current = append;
          else append();
        })
        .catch(() => (loading.current = false));
    }
  }, [active, activeVideoId, cursor, entries.length, flush, tab]);

  // Khoá cuộn trang phía sau: trên iPhone, vuốt có thể cuộn trang nền thay vì khung video.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
      clearTimeout(scrollIdle.current);
      clearTimeout(tapTimer.current);
    };
  }, []);

  function onScroll() {
    scrolling.current = true;
    clearTimeout(scrollIdle.current);
    scrollIdle.current = setTimeout(() => {
      scrolling.current = false;
      const append = pendingAppend.current;
      pendingAppend.current = null;
      append?.();
    }, 250);
  }

  useEffect(() => {
    const onHide = () => {
      for (const [videoId, seconds] of watched.current)
        queue.current.push({ videoId, watchedSeconds: seconds });
      watched.current.clear();
      flush();
    };
    const onVisibility = () => document.visibilityState === 'hidden' && onHide();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flush]);

  function show(text: string, kiotLink = false) {
    setToast({ text, kiotLink });
    setTimeout(() => setToast(null), kiotLink ? 5000 : 2500);
  }

  const patch = (id: string, change: Partial<SocialFeedVideo>) =>
    setItems((list) => list.map((x) => (x.id === id ? { ...x, ...change } : x)));

  async function switchTab(next: Tab) {
    if (next === tab) return;
    if (next === 'following' && requireLogin()) return;
    const res = await fetch(`/api/video/feed?tab=${next}`);
    const page = (await res.json()) as { items: SocialFeedVideo[]; nextCursor: string | null };
    flush();
    setTab(next);
    setItems(page.items);
    setCursor(page.nextCursor);
    setActive(0);
    scroller.current?.scrollTo({ top: 0 });
  }

  async function like(v: SocialFeedVideo, mode: 'toggle' | 'like') {
    if (requireLogin(v.id)) return;
    const res = await fetch('/api/video/like', {
      method: 'POST',
      body: JSON.stringify({ videoId: v.id, mode }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      liked?: boolean;
      likes?: number;
      error?: string;
      limit?: number;
    };
    if (data.ok) patch(v.id, { liked: data.liked!, likes: data.likes! });
    else if (data.error === 'FREE_LIMIT') show(t('feed.freeLimit', { limit: data.limit ?? 50 }), true);
  }

  // Chạm 1 lần: bật/tắt tiếng (chờ 300ms xem có chạm lần 2). Chạm 2 lần: thả tim + túi cam bay tại chỗ chạm.
  function onTap(e: React.MouseEvent, v: SocialFeedVideo) {
    const at = Date.now();
    if (at - lastTap.current < 300) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const id = at + Math.random();
      setPops((p) => [...p, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900);
      void like(v, 'like');
      return;
    }
    lastTap.current = at;
    tapTimer.current = setTimeout(() => setMuted((m) => !m), 300);
  }

  async function follow(v: SocialFeedVideo) {
    if (requireLogin(v.id)) return;
    const res = await fetch('/api/social/follow', {
      method: 'POST',
      body: JSON.stringify({ userId: v.author.id }),
    });
    const data = (await res.json()) as { ok: boolean; following?: boolean; error?: string; limit?: number };
    if (data.ok)
      setItems((list) =>
        list.map((x) => (x.author.id === v.author.id ? { ...x, followingAuthor: data.following! } : x)),
      );
    else if (data.error === 'FREE_LIMIT') show(t('feed.freeLimit', { limit: data.limit ?? 50 }), true);
  }

  async function save(v: SocialFeedVideo) {
    if (requireLogin(v.id)) return;
    const res = await fetch('/api/social/save', { method: 'POST', body: JSON.stringify({ videoId: v.id }) });
    const data = (await res.json()) as { ok: boolean; saved: boolean };
    if (data.ok) patch(v.id, { saved: data.saved });
  }

  async function report(videoId: string, reason: string) {
    setSheet(null);
    if (requireLogin(videoId)) return;
    const res = await fetch('/api/video/report', {
      method: 'POST',
      body: JSON.stringify({ videoId, reason }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    show(
      t(data.ok ? 'feed.reportSent' : data.error === 'OWN_VIDEO' ? 'feed.reportOwn' : 'feed.reportFailed'),
    );
  }

  async function addToCart(productId: string, videoId: string) {
    const form = new FormData();
    form.set('qty', '1');
    const result = await addToCartAction(productId, videoId, {}, form);
    show(result.message ?? (result.ok ? t('feed.addedToCart') : t('feed.cartFailed')));
    if (result.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
  }

  const onCount = useCallback((id: string, count: number) => {
    setItems((list) => list.map((x) => (x.id === id ? { ...x, comments: count } : x)));
  }, []);

  const tabs = home ? (
    <div
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-4 whitespace-nowrap text-[14px] font-bold"
      role="tablist"
    >
      {(['following', 'for-you'] as const).map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => void switchTab(id)}
          className={tab === id ? 'border-b-2 border-white pb-0.5 text-white' : 'text-white/60'}
        >
          {t(id === 'following' ? 'feed.tab.following' : 'feed.tab.forYou')}
        </button>
      ))}
    </div>
  ) : null;

  const frame = `fixed bg-ink text-white ${
    home ? 'inset-x-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] top-16 z-30' : 'inset-0 z-50'
  }`;

  if (entries.length === 0)
    return (
      <div className={`${frame} flex flex-col`}>
        {header}
        <div className="relative grid min-h-0 flex-1 place-items-center p-6 text-center">
          {tabs}
          <div className="flex flex-col items-center gap-4">
            <p className="font-display text-[18px] font-bold">
              {tab === 'following' ? t('feed.emptyFollowing') : t('feed.empty')}
            </p>
            {tab === 'following' ? (
              <button
                type="button"
                onClick={() => void switchTab('for-you')}
                className="h-10 rounded-full bg-brand px-5 text-[13px] font-black"
              >
                {t('feed.seeForYou')}
              </button>
            ) : (
              <Link
                href="/video/dang"
                className="h-10 rounded-full bg-brand px-5 text-[13px] font-black leading-10"
              >
                {t('feed.post')}
              </Link>
            )}
          </div>
        </div>
      </div>
    );

  const action = 'grid h-12 w-12 place-items-center rounded-full border transition';
  const idle = 'border-white/20 bg-white/15 hover:bg-white/25';
  const on = 'border-brand bg-brand shadow-[0_0_16px_#ff6b00]';

  return (
    <div className={`${frame} flex flex-col`}>
      {header}
      <div className="relative min-h-0 flex-1">
        {tabs}
        <div
          ref={scroller}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
          data-testid="video-feed"
          onScroll={onScroll}
        >
          {entries.map((entry, i) => {
            if (entry.kind === 'live')
              return (
                <section
                  key={`live-${entry.live.id}`}
                  data-feed-item
                  data-index={i}
                  data-testid="feed-live"
                  className="relative h-full w-full snap-start snap-always overflow-hidden"
                >
                  <LivePlayer view={entry.live} active={i === active} loggedIn={loggedIn} belowTabs={home} />
                </section>
              );
            const v = entry.video;
            return (
              <section
                key={v.id}
                data-feed-item
                data-index={i}
                data-testid="feed-item"
                className="relative h-full w-full snap-start snap-always overflow-hidden"
              >
                <video
                  ref={(el) => {
                    videos.current[i] = el;
                  }}
                  src={v.fileUrl}
                  poster={v.posterUrl ?? undefined}
                  muted={muted}
                  playsInline
                  loop
                  preload={i === active ? 'auto' : i === active + 1 ? (home ? 'metadata' : 'auto') : 'none'}
                  onClick={(e) => onTap(e, v)}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    watched.current.set(v.id, Math.max(watched.current.get(v.id) ?? 0, el.currentTime));
                    const bar = bars.current[i];
                    if (bar && el.duration) bar.style.width = `${(el.currentTime / el.duration) * 100}%`;
                  }}
                  className="h-full w-full object-contain"
                />
                {/* Thanh tiến độ 2px ở mép trên (V4). */}
                <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-white/10">
                  <span
                    ref={(el) => {
                      bars.current[i] = el;
                    }}
                    className="block h-full w-0 bg-brand"
                  />
                </span>
                {/* Luôn có trong trang, chỉ ẩn/hiện bằng class (xem ghi chú đầu file về Safari). */}
                <button
                  type="button"
                  onClick={() => setMuted(false)}
                  tabIndex={muted && i === active ? 0 : -1}
                  aria-hidden={!(muted && i === active)}
                  className={`absolute left-1/2 top-14 z-10 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-[12px] font-bold ${
                    muted && i === active ? '' : 'pointer-events-none invisible'
                  }`}
                >
                  🔇 {t('feed.unmute')}
                </button>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                <div className="absolute bottom-0 left-0 right-[76px] flex flex-col p-4 pb-6">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {v.pinned ? (
                      <span
                        className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-black"
                        data-testid="feed-pinned"
                      >
                        {t('feed.pinned')}
                      </span>
                    ) : null}
                    {v.duetOfId ? (
                      <Link
                        href={`/v/${v.duetOfId}`}
                        className="flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[10px] font-black"
                      >
                        <Repeat2 className="h-3 w-3" aria-hidden /> {t('feed.duet')} ↗
                      </Link>
                    ) : null}
                    <span className="flex items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2 py-1 text-[10px]">
                      <Eye className="h-3 w-3" aria-hidden />
                      <span className="sr-only">{t('feed.views', { count: v.views })}</span>
                      <span aria-hidden>{formatCount(v.views)}</span>
                    </span>
                  </div>
                  <Link href={`/creator/${v.author.id}`} className="text-[16px] font-black hover:underline">
                    @{v.author.displayName}
                  </Link>
                  {v.caption ? (
                    <p className="mt-1 line-clamp-3 text-[14px] text-white/85">
                      {v.caption.split(/(#[\p{L}\p{N}_]+)/u).map((part, k) =>
                        part.startsWith('#') ? (
                          <Link
                            key={k}
                            href={`/hashtag/${encodeURIComponent(part.slice(1))}`}
                            className="font-bold hover:underline"
                          >
                            {part}
                          </Link>
                        ) : (
                          part
                        ),
                      )}
                    </p>
                  ) : null}
                  {v.products.length > 0 ? (
                    <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" data-testid="feed-products">
                      {v.products.map((p) => (
                        <li
                          key={p.id}
                          className="flex w-[calc(100vw-120px)] max-w-[360px] shrink-0 items-center gap-3 rounded-[14px] bg-white/90 p-2 text-black"
                        >
                          <a
                            href={p.url}
                            className="flex min-w-0 flex-1 items-center gap-3"
                            data-testid="feed-product-link"
                          >
                            <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-brand">
                              {p.thumbUrl ? (
                                <Image
                                  src={p.thumbUrl}
                                  alt=""
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <ShoppingBag className="h-5 w-5 text-white" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-bold">{p.name}</span>
                              <span className="block text-[12px] font-black text-brand">
                                {formatVnd(p.price)}
                              </span>
                            </span>
                          </a>
                          <button
                            type="button"
                            onClick={() => void addToCart(p.id, v.id)}
                            aria-label={t('feed.addToCartLabel', { name: p.name })}
                            className="grid h-8 shrink-0 place-items-center rounded-full bg-brand px-3 text-[11px] font-black text-white"
                            data-testid="feed-add-to-cart"
                          >
                            {t('feed.addToCart')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/kiot-cua-toi/tao"
                      className="grid h-9 place-items-center rounded-full bg-white px-4 text-[12px] font-black text-black"
                    >
                      {t('feed.openKiot')}
                    </Link>
                    <Link
                      href={`/video/dang?duet=${v.id}`}
                      className="flex h-9 items-center gap-1 rounded-full border border-white/20 bg-black/40 px-4 text-[12px] font-bold"
                    >
                      <Repeat2 className="h-4 w-4" aria-hidden /> {t('feed.duet')}
                    </Link>
                  </div>
                </div>

                <div className="absolute bottom-6 right-2 flex w-[72px] flex-col items-center gap-4">
                  <div className="relative mb-2">
                    <Link
                      href={`/creator/${v.author.id}`}
                      className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-brand to-red-500 text-[18px] font-black"
                      aria-label={v.author.displayName}
                    >
                      {v.author.displayName.trim().charAt(0).toUpperCase() || '9'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void follow(v)}
                      aria-label={v.followingAuthor ? t('feed.following') : t('feed.follow')}
                      aria-pressed={v.followingAuthor}
                      data-testid="feed-follow"
                      className={`absolute -bottom-2 left-1/2 h-5 -translate-x-1/2 rounded-full px-1.5 text-[10px] font-black text-white ${
                        v.followingAuthor ? 'bg-zinc-400' : 'bg-brand'
                      }`}
                    >
                      {v.followingAuthor ? '✓' : '+'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void like(v, 'toggle')}
                    aria-label={t('feed.like')}
                    aria-pressed={v.liked}
                    className="flex flex-col items-center gap-1"
                    data-testid="feed-like"
                  >
                    <span className={`${action} ${v.liked ? on : idle}`}>
                      <Heart className={`h-6 w-6 ${v.liked ? 'fill-white' : ''}`} aria-hidden />
                    </span>
                    <span className="text-[11px] font-bold" data-testid="feed-likes">
                      {formatCount(v.likes)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'comments', video: v })}
                    aria-label={t('feed.comment')}
                    className="flex flex-col items-center gap-1"
                    data-testid="feed-comments"
                  >
                    <span className={`${action} ${idle}`}>
                      <MessageCircle className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="text-[11px] font-bold" data-testid="feed-comment-count">
                      {formatCount(v.comments)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void save(v)}
                    aria-label={v.saved ? t('feed.saved') : t('feed.save')}
                    aria-pressed={v.saved}
                    className="flex flex-col items-center gap-1"
                    data-testid="feed-save"
                  >
                    <span className={`${action} ${v.saved ? on : idle}`}>
                      <Bookmark className={`h-5 w-5 ${v.saved ? 'fill-white' : ''}`} aria-hidden />
                    </span>
                    <span className="text-[11px] font-bold">
                      {v.saved ? t('feed.saved') : t('feed.save')}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'share', video: v })}
                    aria-label={t('feed.share')}
                    className="flex flex-col items-center gap-1"
                    data-testid="feed-share"
                  >
                    <span className={`${action} ${idle}`}>
                      <Share2 className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-[11px] font-bold">{t('feed.share')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet({ kind: 'more', video: v })}
                    aria-label={t('feed.more')}
                    className={`${action} ${idle} h-10 w-10`}
                    data-testid="feed-report"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        <div
          className={`absolute left-0 right-0 top-0 z-10 flex items-center p-3 ${home ? 'justify-end' : 'justify-between'}`}
        >
          {home ? null : (
            <Link
              href="/"
              aria-label={t('feed.close')}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-xl"
            >
              ✕
            </Link>
          )}
          {/* Góc trên phải: nút tròn "＋" đăng video (CEO chốt §7 mục 11), không đè lên tab. */}
          <Link
            href="/video/dang"
            aria-label={t('feed.post')}
            className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[20px] font-black leading-none text-white shadow-[0_0_16px_rgb(255_107_0/0.4)]"
          >
            +
          </Link>
        </div>
      </div>

      <CommentsSheet
        videoId={sheet?.kind === 'comments' ? sheet.video.id : null}
        videoAuthorId={sheet?.kind === 'comments' ? sheet.video.author.id : null}
        onClose={() => setSheet(null)}
        onCount={onCount}
        loginHref={loginHref(sheet?.video.id)}
      />
      {sheet?.kind === 'share' ? (
        <ShareSheet
          url={`${appUrl}/v/${sheet.video.id}`}
          title={sheet.video.caption || '9MUA'}
          onClose={() => setSheet(null)}
          onCopied={() => show(t('feed.share.copied'))}
        />
      ) : null}
      <Sheet
        open={sheet?.kind === 'more'}
        onClose={() => setSheet(null)}
        title={t('feed.report')}
        testId="report-sheet"
      >
        <Link
          href={`/video/dang?duet=${sheet?.video.id ?? ''}`}
          className="mb-2 flex items-center gap-2 border-b border-black/10 py-3 font-bold"
        >
          <Repeat2 className="h-4 w-4" aria-hidden /> {t('feed.duet')}
        </Link>
        {REPORT_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => sheet && void report(sheet.video.id, reason)}
            className="block w-full border-b border-black/10 py-3 text-left font-bold"
          >
            {t(`feed.reportReason.${reason}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSheet(null)}
          className="mt-2 w-full py-3 text-center text-black/60"
        >
          {t('feed.cancel')}
        </button>
      </Sheet>

      {/* Túi cam + tim bay lên chỗ chạm 2 lần (V4), gắn vào <body> ngoài khung snap. */}
      {typeof document !== 'undefined'
        ? createPortal(
            <>
              {pops.map((p) => (
                <div
                  key={p.id}
                  className="pointer-events-none fixed z-[70]"
                  style={{ left: p.x - 36, top: p.y - 36, animation: 'bagPop 0.9s ease-out forwards' }}
                  data-testid="heart-pop"
                >
                  <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-brand shadow-[0_0_24px_#ff6b00]">
                    <ShoppingBag className="h-9 w-9 text-white" aria-hidden />
                  </div>
                  <Heart className="absolute -right-2 -top-2 h-7 w-7 fill-white text-white" aria-hidden />
                </div>
              ))}
              {toast ? (
                <div
                  role="status"
                  className={`fixed left-1/2 z-[90] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-3 text-[12px] font-bold text-black shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${
                    home ? 'bottom-24' : 'bottom-6'
                  }`}
                  data-testid="feed-toast"
                >
                  <span className="min-w-0">{toast.text}</span>
                  {toast.kiotLink ? (
                    <Link
                      href="/kiot-cua-toi/tao"
                      className="shrink-0 rounded-full bg-brand px-3 py-1 text-white"
                    >
                      {t('feed.openKiot')}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
