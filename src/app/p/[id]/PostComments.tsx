'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '@/i18n/client';
import type { PostCommentView } from '@/modules/creator';

// Bình luận bài viết (SPEC-creator.md V5.10 mục 3).
export function PostComments({
  postId,
  loggedIn,
  allow,
}: {
  postId: string;
  loggedIn: boolean;
  allow: boolean;
}) {
  const t = useT();
  const [items, setItems] = useState<PostCommentView[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/posts/${postId}/comments`)
      .then((x) => x.json() as Promise<{ items: PostCommentView[] }>)
      .catch(() => ({ items: [] }));
    setItems(r.items);
  }, [postId]);
  useEffect(() => void load(), [load]);
  const send = async () => {
    if (!loggedIn) return window.location.assign(`/dang-nhap?next=${encodeURIComponent(`/p/${postId}`)}`);
    setError(null);
    const r = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((x) => x.json() as Promise<{ ok: boolean; message?: string }>)
      .catch(() => ({ ok: false, message: t('feed.post.err.NETWORK') }));
    if (!r.ok) return setError(r.message ?? t('feed.post.err.NETWORK'));
    setText('');
    await load();
  };
  return (
    <section id="binh-luan" className="flex flex-col gap-2" data-testid="post-comment-list">
      <h2 className="text-[13px] font-black">{t('feed.post.comments', { count: items.length })}</h2>
      {allow ? (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder={t('feed.post.commentHint')}
            className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] text-white"
            data-testid="post-comment-input"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!text.trim()}
            className="h-10 shrink-0 rounded-full bg-brand px-4 text-[12px] font-black text-white disabled:opacity-40"
            data-testid="post-comment-send"
          >
            {t('feed.watch.send')}
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-white/50">{t('feed.post.commentsOff')}</p>
      )}
      {error ? (
        <p role="alert" className="text-[12px] font-bold text-red-300">
          {error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {items.map((c) => (
          <li key={c.id} className="text-[13px]" data-testid="post-comment">
            <b>{c.author.displayName}</b> {c.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
