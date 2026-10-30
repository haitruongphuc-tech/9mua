'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { attachHls } from '@/components/video/hls';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { FeedVideo } from '@/modules/creator';

// Trang phim /watch/<id> (SPEC-creator.md V5.9 mục 4–5): trình phát, danh sách tập, tự phát tập tiếp (tắt được), nhớ tập
// và giây đang xem (đăng nhập: máy chủ; khách: trình duyệt), lưu phim, bình luận theo phút bấm để tua.
type Episode = { videoId: string; episodeNo: number; durationSec: number | null; watched: boolean };
type Comment = { id: string; text: string; atSecond: number | null; author: { displayName: string } };

const AUTOPLAY_KEY = 'watch.autoplay';
const localKey = (seriesId: string) => `watch.progress.${seriesId}`;
export const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function WatchPlayer({
  seriesId,
  episodes,
  videos,
  start,
  loggedIn,
  following: initialFollowing,
}: {
  seriesId: string;
  episodes: Episode[];
  videos: FeedVideo[];
  start: { videoId: string; second: number } | null;
  loggedIn: boolean;
  following: boolean;
}) {
  const t = useT();
  const player = useRef<HTMLVideoElement>(null);
  const [current, setCurrent] = useState(() =>
    Math.max(
      0,
      episodes.findIndex((e) => e.videoId === start?.videoId),
    ),
  );
  const [watched, setWatched] = useState(
    () => new Set(episodes.filter((e) => e.watched).map((e) => e.videoId)),
  );
  const [autoplay, setAutoplay] = useState(true);
  const [following, setFollowing] = useState(initialFollowing);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const seekTo = useRef<number | null>(start?.second ?? null);
  const lastSaved = useRef(0);
  const ep = episodes[current];
  const video = videos.find((v) => v.id === ep?.videoId) ?? null;

  // Khách: tập và giây đang xem lưu trong trình duyệt. Chỗ máy chủ trả về được ưu tiên cho người đã đăng nhập.
  useEffect(() => {
    setAutoplay(readLocal(AUTOPLAY_KEY, true));
    if (loggedIn || start) return;
    const saved = readLocal<{ videoId: string; second: number } | null>(localKey(seriesId), null);
    const i = saved ? episodes.findIndex((e) => e.videoId === saved.videoId) : -1;
    if (saved && i >= 0) {
      seekTo.current = saved.second;
      setCurrent(i);
    }
  }, [episodes, loggedIn, seriesId, start]);

  useEffect(() => {
    const el = player.current;
    if (!el || !video) return;
    let detach: (() => void) | null = null;
    let cancelled = false;
    void attachHls(el, video.fileUrl).then((d) => {
      if (cancelled) d();
      else detach = d;
    });
    return () => {
      cancelled = true;
      detach?.();
    };
  }, [video]);

  const loadComments = useCallback(async () => {
    if (!ep) return;
    const r = await fetch(`/api/social/comments?videoId=${ep.videoId}`)
      .then((x) => x.json() as Promise<{ items: Comment[] }>)
      .catch(() => ({ items: [] }));
    setComments(r.items);
  }, [ep]);
  useEffect(() => void loadComments(), [loadComments]);

  const save = (second: number, force = false) => {
    if (!ep) return;
    const nowMs = Date.now();
    if (!force && nowMs - lastSaved.current < 5000) return;
    lastSaved.current = nowMs;
    writeLocal(localKey(seriesId), { videoId: ep.videoId, second });
    const d = ep.durationSec ?? player.current?.duration ?? 0;
    if (d && second >= d * 0.9) setWatched((s) => new Set(s).add(ep.videoId));
    if (loggedIn)
      void fetch('/api/watch/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: ep.videoId, second }),
      }).catch(() => {});
  };

  const go = (i: number) => {
    if (i < 0 || i >= episodes.length) return;
    seekTo.current = 0;
    setCurrent(i);
  };

  const toggleFollow = async () => {
    if (!loggedIn)
      return window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/watch/${seriesId}`)}`);
    const r = await fetch('/api/watch/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesId }),
    })
      .then((x) => x.json() as Promise<{ ok: boolean; following: boolean }>)
      .catch(() => null);
    if (r?.ok) setFollowing(r.following);
  };

  const sendComment = async () => {
    if (!ep || !draft.trim()) return;
    if (!loggedIn)
      return window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/watch/${seriesId}`)}`);
    setError(null);
    const r = await fetch('/api/social/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: ep.videoId,
        text: draft,
        atSecond: Math.floor(player.current?.currentTime ?? 0),
      }),
    })
      .then((x) => x.json() as Promise<{ ok: boolean; error?: string }>)
      .catch(() => ({ ok: false, error: 'NETWORK' }));
    if (!r.ok) return setError(t('feed.watch.commentFailed'));
    setDraft('');
    await loadComments();
  };

  if (!ep || !video)
    return <p className="py-10 text-center text-[13px] text-white/50">{t('feed.watch.noEpisodes')}</p>;
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <video
          key={video.id}
          ref={player}
          poster={video.posterUrl ?? undefined}
          controls
          playsInline
          autoPlay={seekTo.current !== null && current > 0 ? autoplay : false}
          className="aspect-[9/16] max-h-[70vh] w-full rounded-[16px] bg-black object-contain"
          onLoadedMetadata={(e) => {
            if (seekTo.current) e.currentTarget.currentTime = seekTo.current;
            seekTo.current = null;
          }}
          onTimeUpdate={(e) => save(e.currentTarget.currentTime)}
          onPause={(e) => save(e.currentTarget.currentTime, true)}
          onEnded={(e) => {
            save(e.currentTarget.duration, true);
            if (autoplay && current < episodes.length - 1) {
              seekTo.current = 0;
              setCurrent(current + 1);
            }
          }}
          data-testid="watch-player"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black" data-testid="watch-current">
            {t('feed.watch.episode', { n: ep.episodeNo })}
          </span>
          <label className="flex items-center gap-2 text-[12px] font-bold text-white/70">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => {
                setAutoplay(e.target.checked);
                writeLocal(AUTOPLAY_KEY, e.target.checked);
              }}
              className="h-4 w-4 accent-[#ff6b00]"
              data-testid="watch-autoplay"
            />
            {t('feed.watch.autoplay')}
          </label>
          <button
            type="button"
            onClick={() => void toggleFollow()}
            aria-pressed={following}
            className={`ml-auto h-9 rounded-full px-4 text-[12px] font-black ${following ? 'bg-white/10' : 'bg-brand text-white'}`}
            data-testid="watch-save"
          >
            {following ? `✓ ${t('feed.watch.saved')}` : `＋ ${t('feed.watch.save')}`}
          </button>
        </div>
        {video.products.length ? (
          <ul className="flex flex-wrap gap-2" data-testid="watch-products">
            {video.products.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  className="flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-bold text-black"
                >
                  🛍 {p.name} · {formatVnd(p.price)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <section className="flex flex-col gap-2" data-testid="watch-comments">
          <h2 className="text-[13px] font-black">{t('feed.watch.comments', { count: comments.length })}</h2>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 300))}
              placeholder={t('feed.watch.commentHint')}
              className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] text-white"
              data-testid="watch-comment-input"
            />
            <button
              type="button"
              onClick={() => void sendComment()}
              disabled={!draft.trim()}
              className="h-10 shrink-0 rounded-full bg-brand px-4 text-[12px] font-black text-white disabled:opacity-40"
              data-testid="watch-comment-send"
            >
              {t('feed.watch.send')}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-[12px] font-bold text-red-300">
              {error}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {comments.map((c) => (
              <li key={c.id} className="text-[13px]" data-testid="watch-comment">
                {c.atSecond !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (player.current) player.current.currentTime = c.atSecond!;
                    }}
                    className="mr-2 rounded-full bg-brand/20 px-2 py-0.5 text-[11px] font-black tabular-nums text-brand"
                    data-testid="watch-comment-at"
                  >
                    {mmss(c.atSecond)}
                  </button>
                ) : null}
                <b>{c.author.displayName}</b> {c.text}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className="lg:w-72">
        <h2 className="mb-2 text-[13px] font-black">
          {t('feed.watch.episodes', { count: episodes.length })}
        </h2>
        <ol className="grid grid-cols-5 gap-2 lg:grid-cols-4" data-testid="watch-episodes">
          {episodes.map((e, i) => (
            <li key={e.videoId}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === current}
                className={`relative h-11 w-full rounded-[10px] text-[13px] font-black tabular-nums ${i === current ? 'bg-brand text-white' : 'bg-white/10'}`}
                data-testid="watch-episode"
              >
                {e.episodeNo}
                {watched.has(e.videoId) ? (
                  <span className="absolute right-1 top-0.5 text-[9px]" aria-label={t('feed.watch.watched')}>
                    ✓
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
        <Link
          href={`/creator/${video.author.id}`}
          className="mt-3 block text-[12px] font-bold text-white/70 hover:underline"
        >
          @{video.author.displayName}
        </Link>
      </aside>
    </div>
  );
}
