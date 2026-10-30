'use client';

import { Heart, Send } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useFeature, useMe } from '@/components/MeProvider';
import { BlockButton } from '@/components/social/BlockButton';
import { Avatar } from '@/components/ui/Avatar';
import { MentionInput } from '@/components/ui/MentionInput';
import { RichText } from '@/components/ui/RichText';
import { useT } from '@/i18n/client';
import { Sheet } from './Sheet';

type C = {
  id: string;
  text: string;
  pinned: boolean;
  author: { id: string; displayName: string; avatarUrl: string | null };
  byVideoAuthor: boolean;
  likeCount?: number;
  liked?: boolean;
  mutedHidden?: boolean;
  replyVideoId?: string | null;
};
type Root = C & { replies: C[] };

// Bình luận video kiểu V4 (SPEC-social.md mục 3): trả lời 1 cấp, người đăng ghim/ẩn, báo cáo, không cho link.
export function CommentsSheet({
  videoId,
  videoAuthorId,
  onClose,
  onCount,
  loginHref,
}: {
  videoId: string | null;
  videoAuthorId: string | null;
  onClose: () => void;
  onCount: (videoId: string, count: number) => void;
  loginHref: string;
}) {
  const t = useT();
  const { me } = useMe();
  const canBlock = useFeature('social_more');
  const [items, setItems] = useState<Root[]>([]);
  const [total, setTotal] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<C | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Bình luận bị ẩn vì từ cấm của chủ video (SPEC-social.md V5.4 mục 3).
  const [muted, setMuted] = useState<Root[]>([]);
  const [showMuted, setShowMuted] = useState(false);

  const load = useCallback(async () => {
    if (!videoId) return;
    const res = await fetch(`/api/social/comments?videoId=${encodeURIComponent(videoId)}`, {
      cache: 'no-store',
    });
    const data = (await res.json()) as {
      items: Root[];
      total: number;
      me: string | null;
      mutedHidden?: Root[];
    };
    setItems(data.items);
    setMuted(data.mutedHidden ?? []);
    setTotal(data.total);
    setMyId(data.me);
    onCount(videoId, data.total);
  }, [videoId, onCount]);

  useEffect(() => {
    setItems([]);
    setReplyTo(null);
    setError(null);
    void load();
  }, [load]);

  async function send() {
    if (!videoId || !text.trim() || sending) return;
    if (!me) {
      window.location.href = loginHref;
      return;
    }
    setSending(true);
    const res = await fetch('/api/social/comments', {
      method: 'POST',
      body: JSON.stringify({ videoId, text, parentId: replyTo?.id }),
    });
    setSending(false);
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      const known = ['HAS_LINK', 'RATE_LIMIT', 'DAILY_LIMIT', 'TOO_LONG'] as const;
      const code = known.find((k) => k === data.error);
      setError(t(code ? `feed.comments.err.${code}` : 'feed.comments.err.other'));
      return;
    }
    setText('');
    setReplyTo(null);
    setError(null);
    await load();
  }

  // Tim bình luận (SPEC-social.md V5.4 mục 1): đổi ngay trên màn hình, máy chủ trả số thật.
  async function like(c: C) {
    if (!me) {
      window.location.href = loginHref;
      return;
    }
    const res = await fetch('/api/social/comment-like', {
      method: 'POST',
      body: JSON.stringify({ commentId: c.id }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok: boolean;
      liked?: boolean;
      likeCount?: number;
    } | null;
    if (!data?.ok) return setError(t('feed.comments.err.RATE_LIMIT'));
    const patch = (x: C): C => (x.id === c.id ? { ...x, liked: data.liked, likeCount: data.likeCount } : x);
    setItems((list) => list.map((r) => ({ ...patch(r), replies: r.replies.map(patch) }) as Root));
  }

  async function act(commentId: string, action: 'pin' | 'hide' | 'report' | 'unhide') {
    const res = await fetch('/api/social/comment-action', {
      method: 'POST',
      body: JSON.stringify({ commentId, action, reason: 'khac' }),
    });
    if (res.status === 401) {
      window.location.href = loginHref;
      return;
    }
    if (action === 'report') setError(t('feed.comments.reported'));
    await load();
  }

  const owner = Boolean(myId && videoAuthorId && myId === videoAuthorId);
  const line = (c: C, isRoot: boolean) => (
    <div
      className={`flex gap-2 rounded-[14px] px-3 py-2 ${c.pinned ? 'border border-brand/30 bg-brand-cream' : 'bg-zinc-50'}`}
      data-testid="comment"
    >
      <Link href={`/creator/${c.author.id}`} aria-label={c.author.displayName} className="shrink-0">
        <Avatar name={c.author.displayName} url={c.author.avatarUrl} className="h-8 w-8 text-[12px]" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold">
          {c.author.displayName}
          {c.byVideoAuthor ? (
            <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] text-white">
              {t('feed.comments.author')}
            </span>
          ) : null}
          {c.pinned ? <span className="ml-1 text-[10px] text-brand">{t('feed.comments.pinned')}</span> : null}
        </p>
        <p className="whitespace-pre-line text-[13px]">
          <RichText text={c.text} />
        </p>
        {c.mutedHidden && c.author.id === myId ? (
          <p className="text-[10px] text-zinc-500">{t('feed.comments.mutedOwn')}</p>
        ) : null}
        <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
          {c.mutedHidden && owner ? (
            <button
              type="button"
              onClick={() => act(c.id, 'unhide')}
              className="font-bold text-brand"
              data-testid="comment-unhide"
            >
              {t('feed.comments.unhide')}
            </button>
          ) : null}
          {c.replyVideoId ? (
            <Link
              href={`/v/${c.replyVideoId}`}
              className="font-bold text-brand"
              data-testid="comment-video-reply"
            >
              ▶ {t('feed.comments.repliedVideo')}
            </Link>
          ) : owner && isRoot && canBlock && !c.mutedHidden ? (
            <Link
              href={`/video/dang?tra-loi=${c.id}`}
              className="font-bold"
              data-testid="comment-reply-video"
            >
              🎬 {t('feed.comments.replyVideo')}
            </Link>
          ) : null}
          {isRoot ? (
            <button type="button" onClick={() => setReplyTo(c)}>
              {t('feed.comments.reply')}
            </button>
          ) : null}
          {owner && isRoot ? (
            <button type="button" onClick={() => act(c.id, 'pin')}>
              {c.pinned ? t('feed.comments.unpin') : t('feed.comments.pin')}
            </button>
          ) : null}
          {owner ? (
            <button type="button" onClick={() => act(c.id, 'hide')}>
              {t('feed.comments.hide')}
            </button>
          ) : null}
          {myId && myId !== c.author.id ? (
            <button type="button" onClick={() => act(c.id, 'report')}>
              {t('feed.comments.reportAction')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void like(c)}
            aria-pressed={Boolean(c.liked)}
            aria-label={t('feed.comments.like')}
            className="ml-auto flex items-center gap-0.5"
            data-testid="comment-like"
          >
            <Heart className={`h-3.5 w-3.5 ${c.liked ? 'fill-brand text-brand' : ''}`} aria-hidden />
            {c.likeCount ? <span>{c.likeCount}</span> : null}
          </button>
          {myId && myId !== c.author.id && canBlock ? (
            <BlockButton
              userId={c.author.id}
              name={c.author.displayName}
              className=""
              onDone={() => void load()}
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <Sheet
      open={Boolean(videoId)}
      onClose={onClose}
      title={t('feed.comments.title', { count: total })}
      testId="comments-sheet"
    >
      {owner && muted.length ? (
        <div className="mb-2 rounded-[12px] bg-zinc-100 px-3 py-2 text-[12px]" data-testid="comments-muted">
          <button type="button" onClick={() => setShowMuted((v) => !v)} className="font-bold">
            {t('feed.comments.mutedCount', { count: muted.length })}
          </button>{' '}
          ·{' '}
          <Link href="/tai-khoan/cai-dat#tu-cam" className="font-bold text-brand">
            {t('feed.comments.editMuted')}
          </Link>
          {showMuted ? (
            <div className="mt-2 space-y-2">
              {muted.map((c) => (
                <div key={c.id}>{line(c, false)}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="max-h-[45dvh] space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-zinc-500">{t('feed.comments.empty')}</p>
        ) : (
          items.map((c) => (
            <div key={c.id}>
              {line(c, true)}
              {c.replies.map((r) => (
                <div key={r.id} className="ml-6 mt-1">
                  {line(r, false)}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      {replyTo ? (
        <p className="mt-2 text-[11px] text-brand">
          {t('feed.comments.replyingTo', { name: replyTo.author.displayName })} •{' '}
          <button type="button" onClick={() => setReplyTo(null)} className="underline">
            {t('feed.comments.cancelReply')}
          </button>
        </p>
      ) : null}
      {error ? (
        <p role="status" className="mt-2 text-[12px] font-bold text-danger" data-testid="comment-error">
          {error}
        </p>
      ) : null}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <MentionInput
          value={text}
          onChange={setText}
          maxLength={300}
          data-testid="comment-input"
          placeholder={me ? t('feed.comments.placeholder') : t('feed.comments.loginPlaceholder')}
          onFocus={() => {
            if (me === null) window.location.href = loginHref;
          }}
          aria-label={t('feed.comments.placeholder')}
          className="h-11 w-full rounded-full border border-black/10 px-4 text-[14px] outline-none focus:border-brand"
        />
        <button
          type="submit"
          aria-label={t('feed.comments.send')}
          disabled={sending}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </Sheet>
  );
}
