'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addToCartAction } from '@/components/orders/add-to-cart-action';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { formatVnd } from '@/lib/format';
import type { FeedVideo } from '@/modules/creator';

type ViewEntry = { videoId: string; watchedSeconds: number };

const REPORT_REASONS = [
  ['noi_dung_xau', 'Nội dung xấu, phản cảm'],
  ['lua_dao', 'Lừa đảo'],
  ['ban_quyen', 'Vi phạm bản quyền'],
  ['khac', 'Khác'],
] as const;

// Feed video dọc toàn màn hình (SPEC-creator.md mục 3): vuốt lên/xuống, tự phát tắt tiếng, chạm để bật
// tiếng, tải trước video kế tiếp, lượt xem gửi theo lô.
// Safari iPhone kéo khung snap về video cũ nếu cấu trúc trang đổi giữa lúc đang vuốt (WebKit bug 173830):
// không thêm/bớt phần tử trong các video khi đổi video đang xem (chỉ đổi class), và chỉ nối thêm video
// tải về sau khi ngón tay đã dừng vuốt.
// variant "page" (/video, /v/<id>): toàn màn hình, có nút ✕. "home" (trang chủ, T40): nằm giữa thanh trên và
// thanh điều hướng dưới, chỉ tải trước video đang xem để tiết kiệm 4G.
export function VideoFeed({
  initial,
  nextCursor,
  appUrl,
  variant = 'page',
}: {
  initial: FeedVideo[];
  nextCursor: string | null;
  appUrl: string;
  variant?: 'page' | 'home';
}) {
  const home = variant === 'home';
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const watched = useRef(new Map<string, number>());
  const queue = useRef<ViewEntry[]>([]);
  const loading = useRef(false);
  const scrolling = useRef(false);
  const scrollIdle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingAppend = useRef<(() => void) | null>(null);

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
  }, [items.length]);

  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) void v.play().catch(() => {});
      else v.pause();
    });
    // Rời video trước: ghi lại thời gian đã xem vào hàng chờ.
    for (const [videoId, seconds] of watched.current)
      if (videoId !== items[active]?.id && seconds > 0) {
        queue.current.push({ videoId, watchedSeconds: seconds });
        watched.current.delete(videoId);
      }
    if (queue.current.length >= 5) flush();
    if (cursor && !loading.current && active >= items.length - 3) {
      loading.current = true;
      fetch(`/api/video/feed?sau=${encodeURIComponent(cursor)}`)
        .then((r) => r.json())
        .then((page: { items: FeedVideo[]; nextCursor: string | null }) => {
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
  }, [active, cursor, items, flush]);

  // Khoá cuộn trang phía sau: trên iPhone, vuốt có thể cuộn trang nền thay vì khung video.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
      clearTimeout(scrollIdle.current);
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

  function show(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  async function like(i: number) {
    const v = items[i]!;
    const res = await fetch('/api/video/like', { method: 'POST', body: JSON.stringify({ videoId: v.id }) });
    if (res.status === 401) {
      window.location.href = `/dang-nhap?next=${encodeURIComponent(`/v/${v.id}`)}`;
      return;
    }
    const data = (await res.json()) as { ok: boolean; liked: boolean; likes: number };
    if (data.ok)
      setItems((list) => list.map((x, j) => (j === i ? { ...x, liked: data.liked, likes: data.likes } : x)));
  }

  async function share(v: FeedVideo) {
    const url = `${appUrl}/v/${v.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: v.caption || 'Video trên 9MUA' });
      else {
        await navigator.clipboard.writeText(url);
        show('Đã sao chép link video');
      }
    } catch {}
  }

  async function report(videoId: string, reason: string) {
    setReporting(null);
    const res = await fetch('/api/video/report', {
      method: 'POST',
      body: JSON.stringify({ videoId, reason }),
    });
    if (res.status === 401) {
      window.location.href = `/dang-nhap?next=${encodeURIComponent(`/v/${videoId}`)}`;
      return;
    }
    const data = (await res.json()) as { ok: boolean; error?: string };
    show(
      data.ok
        ? 'Đã gửi báo cáo. 9MUA sẽ xem xét.'
        : data.error === 'OWN_VIDEO'
          ? 'Đây là video của bạn.'
          : 'Không gửi được báo cáo',
    );
  }

  async function addToCart(productId: string, videoId: string) {
    const form = new FormData();
    form.set('qty', '1');
    const result = await addToCartAction(productId, videoId, {}, form);
    show(result.message ?? (result.ok ? 'Đã thêm vào giỏ hàng.' : 'Không thêm được'));
    if (result.ok) window.dispatchEvent(new Event(ME_CHANGED_EVENT));
  }

  if (items.length === 0)
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black p-6 text-center text-white">
        <div className="flex flex-col items-center gap-4">
          <p>Chưa có video nào. Hãy là người đầu tiên!</p>
          <Link href="/video/dang" className="rounded-full bg-brand px-6 py-3 font-extrabold text-brand-ink">
            Đăng video
          </Link>
          <Link href="/" className="underline">
            Về trang chủ
          </Link>
        </div>
      </div>
    );

  return (
    <div
      className={`fixed bg-black text-white ${
        home ? 'inset-x-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] top-16 z-30' : 'inset-0 z-50'
      }`}
    >
      <div
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
        data-testid="video-feed"
        onScroll={onScroll}
      >
        {items.map((v, i) => (
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
              onClick={() => setMuted((m) => !m)}
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime;
                watched.current.set(v.id, Math.max(watched.current.get(v.id) ?? 0, t));
              }}
              className="h-full w-full object-contain"
            />
            {/* Luôn có trong trang, chỉ ẩn/hiện bằng class (xem ghi chú đầu file về Safari). */}
            <button
              type="button"
              onClick={() => setMuted(false)}
              tabIndex={muted && i === active ? 0 : -1}
              aria-hidden={!(muted && i === active)}
              className={`absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm font-bold ${
                muted && i === active ? '' : 'pointer-events-none invisible'
              }`}
            >
              🔇 Chạm để bật tiếng
            </button>
            <div className="absolute bottom-0 left-0 right-16 flex flex-col gap-2 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6">
              <Link href={`/creator/${v.author.id}`} className="font-extrabold">
                @{v.author.displayName}
              </Link>
              {v.caption ? <p className="line-clamp-3 text-sm">{v.caption}</p> : null}
              {v.products.length > 0 ? (
                <ul className="flex gap-2 overflow-x-auto" data-testid="feed-products">
                  {v.products.map((p) => (
                    <li
                      key={p.id}
                      className="flex w-56 shrink-0 items-center gap-2 rounded-xl bg-white p-2 text-brand-ink"
                    >
                      <a
                        href={p.url}
                        className="flex min-w-0 flex-1 items-center gap-2"
                        data-testid="feed-product-link"
                      >
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                          {p.thumbUrl ? (
                            <Image
                              src={p.thumbUrl}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{p.name}</span>
                          <span className="text-sm font-extrabold text-brand-deep">{formatVnd(p.price)}</span>
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => addToCart(p.id, v.id)}
                        aria-label={`Thêm ${p.name} vào giỏ`}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand font-extrabold"
                        data-testid="feed-add-to-cart"
                      >
                        🛒
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => like(i)}
                aria-pressed={v.liked}
                aria-label="Thích"
                className="flex flex-col items-center text-xs font-bold"
                data-testid="feed-like"
              >
                <span className={`text-3xl ${v.liked ? 'text-brand' : ''}`}>{v.liked ? '♥' : '♡'}</span>
                <span data-testid="feed-likes">{v.likes.toLocaleString('vi-VN')}</span>
              </button>
              <button
                type="button"
                onClick={() => share(v)}
                aria-label="Chia sẻ"
                className="flex flex-col items-center text-xs font-bold"
              >
                <span className="text-3xl">↗</span>
                Chia sẻ
              </button>
              <button
                type="button"
                onClick={() => setReporting(v.id)}
                aria-label="Báo cáo video"
                className="text-2xl"
                data-testid="feed-report"
              >
                ⋯
              </button>
            </div>
          </section>
        ))}
      </div>
      <div
        className={`absolute left-0 right-0 top-0 z-10 flex items-center p-3 ${
          home ? 'justify-end' : 'justify-between'
        }`}
      >
        {home ? null : (
          <Link
            href="/"
            aria-label="Đóng"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-xl"
          >
            ✕
          </Link>
        )}
        <Link
          href="/video/dang"
          className="rounded-full bg-brand px-4 py-2 text-[12px] font-black text-white shadow-[0_0_16px_rgb(255_107_0/0.4)]"
        >
          + Đăng video
        </Link>
      </div>
      {/* Bảng báo cáo và thông báo gắn vào <body> để luôn nổi trên thanh điều hướng dưới. */}
      {reporting && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex items-end bg-black/50"
              onClick={() => setReporting(null)}
            >
              <div
                className="w-full rounded-t-3xl bg-white p-4 text-brand-ink"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Báo cáo video"
              >
                <p className="mb-2 font-extrabold">Báo cáo video</p>
                {REPORT_REASONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => report(reporting, value)}
                    className="block w-full border-b border-black/10 py-3 text-left font-bold"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReporting(null)}
                  className="mt-2 w-full py-3 text-center text-black/60"
                >
                  Huỷ
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {toast && typeof document !== 'undefined'
        ? createPortal(
            <p
              role="status"
              className={`fixed left-1/2 z-[60] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-ink ${
                home ? 'bottom-24' : 'bottom-6'
              }`}
              data-testid="feed-toast"
            >
              {toast}
            </p>,
            document.body,
          )
        : null}
    </div>
  );
}
