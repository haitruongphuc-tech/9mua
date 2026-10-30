'use client';

import { Send } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useMe } from '@/components/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { useT } from '@/i18n/client';
import { Sheet } from './Sheet';

type C = {
  id: string;
  text: string;
  pinned: boolean;
  author: { id: string; displayName: string; avatarUrl: string | null };
  byVideoAuthor: boolean;
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
  const [items, setItems] = useState<Root[]>([]);
  const [total, setTotal] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<C | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!videoId) return;
    const res = await fetch(`/api/social/comments?videoId=${encodeURIComponent(videoId)}`, {
      cache: 'no-store',
    });
    const data = (await res.json()) as { items: Root[]; total: number; me: string | null };
    setItems(data.items);
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

  async function act(commentId: string, action: 'pin' | 'hide' | 'report') {
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
        <p className="whitespace-pre-line text-[13px]">{c.text}</p>
        <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
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
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={me ? t('feed.comments.placeholder') : t('feed.comments.loginPlaceholder')}
          onFocus={() => {
            if (me === null) window.location.href = loginHref;
          }}
          aria-label={t('feed.comments.placeholder')}
          className="h-11 min-w-0 flex-1 rounded-full border border-black/10 px-4 text-[14px] outline-none focus:border-brand"
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
