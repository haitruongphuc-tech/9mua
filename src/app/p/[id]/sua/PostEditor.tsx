'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { updatePostAction } from '../actions';

// Sửa bài sau khi đăng (SPEC-creator.md V5.10 mục 1): chữ, bỏ / thêm ảnh (≤ 10), giữ sản phẩm.
export function PostEditor({
  postId,
  initial,
}: {
  postId: string;
  initial: {
    text: string;
    images: { url: string; thumbUrl: string }[];
    productIds: string[];
    bgColor: string | null;
  };
}) {
  const t = useT();
  const [text, setText] = useState(initial.text);
  const [keep, setKeep] = useState(initial.images);
  const [added, setAdded] = useState<{ id: string; thumbUrl: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = keep.length + added.length;
  async function add(files: File[]) {
    for (const f of files.slice(0, 10 - total)) {
      const form = new FormData();
      form.set('file', f);
      const r = await fetch('/api/posts/images', { method: 'POST', body: form })
        .then((x) => x.json() as Promise<{ ok: boolean; id?: string; thumbUrl?: string }>)
        .catch(() => ({ ok: false }) as { ok: boolean; id?: string; thumbUrl?: string });
      if (r.ok && r.id && r.thumbUrl) setAdded((l) => [...l, { id: r.id!, thumbUrl: r.thumbUrl! }]);
      else setError(t('post.article.imageFailed'));
    }
  }
  async function save() {
    setBusy(true);
    const r = await updatePostAction(postId, {
      text,
      keepImageUrls: keep.map((i) => i.url),
      imageIds: added.map((i) => i.id),
      productIds: initial.productIds,
      bgColor: total ? null : initial.bgColor,
    });
    setBusy(false);
    if (r?.error) setError(r.error);
  }
  return (
    <div className="flex flex-col gap-3" data-testid="post-editor">
      {error ? (
        <p role="alert" className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300">
          {error}
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        rows={6}
        className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-[14px] text-white outline-none focus:border-brand"
        data-testid="post-edit-text"
      />
      <ul className="flex flex-wrap gap-2">
        {[
          ...keep.map((i) => ({
            key: i.url,
            thumbUrl: i.thumbUrl,
            drop: () => setKeep((l) => l.filter((x) => x.url !== i.url)),
          })),
          ...added.map((i) => ({
            key: i.id,
            thumbUrl: i.thumbUrl,
            drop: () => setAdded((l) => l.filter((x) => x.id !== i.id)),
          })),
        ].map((i) => (
          <li key={i.key} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.thumbUrl} alt="" className="h-20 w-20 rounded-[10px] object-cover" />
            <button
              type="button"
              onClick={i.drop}
              aria-label={t('post.edit.remove')}
              className="absolute right-1 top-1 h-7 w-7 rounded-full bg-black/70 text-[12px]"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      {total < 10 ? (
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-[14px] border border-dashed border-white/30 text-[13px] font-bold">
          🖼 {t('post.article.addImages')}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              void add(files);
            }}
          />
        </label>
      ) : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="h-12 rounded-full bg-brand font-black text-white disabled:opacity-50"
        data-testid="post-edit-save"
      >
        {t('post.series.save')}
      </button>
    </div>
  );
}
