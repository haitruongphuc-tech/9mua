'use client';

import { Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { RichText } from '@/components/ui/RichText';
import { formatVnd } from '@/lib/format';
import type { PostView } from '@/modules/creator';

// Bài đăng ảnh + chữ (SPEC-creator.md V5.10): ảnh vuốt ngang, bài chữ có nền màu chữ to ở giữa, hashtag bấm được.
// variant "slide": một màn hình trong feed dọc trang chủ; "card": danh sách (trang cá nhân, hashtag, trang bài).
export function PostCard({
  post,
  variant = 'card',
  loggedIn,
  onToast,
}: {
  post: PostView;
  variant?: 'slide' | 'card';
  loggedIn: boolean;
  onToast?: (text: string) => void;
}) {
  const t = useT();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(post.saved);
  const login = () => window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/p/${post.id}`)}`);
  const act = async (path: string) =>
    fetch(`/api/posts/${post.id}/${path}`, { method: 'POST' })
      .then((r) => r.json())
      .catch(() => null);
  const like = async () => {
    if (!loggedIn) return login();
    const r = (await act('like')) as { ok: boolean; liked: boolean; likes: number } | null;
    if (r?.ok) {
      setLiked(r.liked);
      setLikes(r.likes);
    }
  };
  const save = async () => {
    if (!loggedIn) return login();
    const r = (await act('save')) as { ok: boolean; saved: boolean } | null;
    if (r?.ok) {
      setSaved(r.saved);
      onToast?.(t(r.saved ? 'feed.post.saved' : 'feed.post.unsaved'));
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    if (typeof navigator.share === 'function') return void navigator.share({ url }).catch(() => {});
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    onToast?.(t('feed.share.copied'));
  };
  const slide = variant === 'slide';
  const body = (
    <p
      className={
        post.bgColor
          ? 'whitespace-pre-line break-words text-center text-[22px] font-black leading-snug'
          : `whitespace-pre-line break-words text-[14px] ${slide ? 'line-clamp-6 text-white/90' : ''}`
      }
      data-testid="post-text"
    >
      <RichText text={post.text} />
    </p>
  );
  const btn = 'flex flex-col items-center gap-0.5 text-[11px] font-bold';
  return (
    <article
      className={
        slide
          ? 'relative flex h-full w-full flex-col justify-center overflow-hidden bg-ink'
          : 'flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-3'
      }
      data-testid="post-card"
    >
      <div className={`flex items-center gap-2 ${slide ? 'absolute left-4 right-[76px] top-16 z-10' : ''}`}>
        <Link href={`/creator/${post.author.id}`} className="truncate text-[14px] font-black hover:underline">
          @{post.author.displayName}
        </Link>
        {post.edited ? <span className="text-[11px] text-white/50">· {t('feed.post.edited')}</span> : null}
        {post.visibility !== 'public' ? (
          <span className="text-[11px] text-white/50">· {t(`feed.post.visibility.${post.visibility}`)}</span>
        ) : null}
      </div>
      {post.images.length ? (
        <div
          className={`no-scrollbar flex snap-x snap-mandatory overflow-x-auto ${slide ? 'max-h-[70%]' : 'rounded-[12px]'}`}
          data-testid="post-images"
        >
          {post.images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.url}
              src={img.url}
              alt=""
              width={img.width}
              height={img.height}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={`w-full shrink-0 snap-center object-contain ${slide ? 'max-h-[70vh]' : 'max-h-[480px] bg-black'}`}
            />
          ))}
        </div>
      ) : null}
      {post.bgColor ? (
        <div
          className={`flex items-center justify-center p-6 ${slide ? 'min-h-[50%]' : 'aspect-square rounded-[12px]'}`}
          style={{ background: post.bgColor }}
        >
          {body}
        </div>
      ) : post.text ? (
        <div className={slide ? 'absolute bottom-0 left-0 right-[76px] p-4 pb-6' : ''}>{body}</div>
      ) : null}
      {post.images.length > 1 ? (
        <p className={`text-[11px] text-white/50 ${slide ? 'absolute right-[76px] top-24 z-10' : ''}`}>
          {t('feed.post.photos', { count: post.images.length })}
        </p>
      ) : null}
      {post.products.length ? (
        <ul className={`flex flex-wrap gap-2 ${slide ? 'absolute bottom-24 left-4 right-[76px]' : ''}`}>
          {post.products.map((p) => (
            <li key={p.id}>
              <a
                href={p.url}
                className="flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold text-black"
              >
                🛍 {p.name} · {formatVnd(p.price)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className={
          slide
            ? 'absolute bottom-24 right-3 z-10 flex flex-col items-center gap-4'
            : 'flex items-center gap-6 border-t border-white/10 pt-2'
        }
      >
        <button
          type="button"
          onClick={() => void like()}
          aria-pressed={liked}
          className={btn}
          data-testid="post-like"
        >
          <Heart className={`h-6 w-6 ${liked ? 'fill-brand text-brand' : ''}`} aria-hidden />
          <span>{likes}</span>
        </button>
        <Link href={`/p/${post.id}#binh-luan`} className={btn} data-testid="post-comments">
          <MessageCircle className="h-6 w-6" aria-hidden />
          <span>{post.comments}</span>
        </Link>
        <button
          type="button"
          onClick={() => void save()}
          aria-pressed={saved}
          className={btn}
          data-testid="post-save"
        >
          <Bookmark className={`h-6 w-6 ${saved ? 'fill-white' : ''}`} aria-hidden />
          <span className="sr-only">{t('feed.post.save')}</span>
        </button>
        <button type="button" onClick={() => void share()} className={btn} data-testid="post-share">
          <Share2 className="h-6 w-6" aria-hidden />
          <span className="sr-only">{t('feed.share')}</span>
        </button>
      </div>
    </article>
  );
}
