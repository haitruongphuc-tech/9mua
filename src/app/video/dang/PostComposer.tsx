'use client';

import { useEffect, useState } from 'react';
import type { PickableProduct } from '@/app/api/video/products/route';
import { formatVnd } from '@/lib/format';
import { useT } from '@/i18n/client';
import { createPostAction } from './post-actions';

// Đăng bài ảnh + chữ (SPEC-creator.md V5.10 mục 1): chữ ≤ 2.000 ký tự, 0–10 ảnh (đổi thứ tự), bài chỉ chữ ≤ 300 ký tự chọn
// 1 trong 6 nền màu; quyền riêng tư; lưu nháp.
const MAX_TEXT = 2000;
const MAX_BG_TEXT = 300;
const MAX_IMAGES = 10;
const COLORS = ['#ff6b00', '#e11d48', '#7c3aed', '#0ea5e9', '#16a34a', '#111111'] as const;
type Img = { id: string; thumbUrl: string };

export function PostComposer({ postOptions }: { postOptions: boolean }) {
  const t = useT();
  const [text, setText] = useState('');
  const [images, setImages] = useState<Img[]>([]);
  const [bg, setBg] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableProduct[]>([]);
  const [picked, setPicked] = useState<PickableProduct[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/video/products?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { items: PickableProduct[] }) => setResults(d.items))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const toggle = (p: PickableProduct) =>
    setPicked((list) =>
      list.some((x) => x.id === p.id)
        ? list.filter((x) => x.id !== p.id)
        : list.length < 3
          ? [...list, p]
          : list,
    );
  const canBg = images.length === 0 && text.trim().length > 0 && text.length <= MAX_BG_TEXT;

  async function add(files: File[]) {
    setError(null);
    const room = MAX_IMAGES - images.length;
    if (files.length > room) setError(t('post.article.tooManyImages', { max: MAX_IMAGES }));
    for (const f of files.slice(0, room)) {
      setUploading((n) => n + 1);
      const form = new FormData();
      form.set('file', f);
      type Reply = { ok: boolean; id?: string; thumbUrl?: string; error?: string };
      const r: Reply = await fetch('/api/posts/images', { method: 'POST', body: form })
        .then((x) => x.json() as Promise<Reply>)
        .catch(() => ({ ok: false, error: 'NETWORK' }));
      setUploading((n) => n - 1);
      if (r.ok && r.id && r.thumbUrl) setImages((list) => [...list, { id: r.id!, thumbUrl: r.thumbUrl! }]);
      else setError(t('post.article.imageFailed'));
    }
    setBg(null);
  }
  const move = (i: number, by: -1 | 1) =>
    setImages((list) => {
      const next = [...list];
      const [x] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, x!);
      return next;
    });

  async function submit(asDraft: boolean) {
    setBusy(true);
    setError(null);
    const r = await createPostAction({
      text,
      imageIds: images.map((i) => i.id),
      bgColor: canBg ? bg : null,
      productIds: picked.map((p) => p.id),
      visibility,
      draft: asDraft,
    });
    setBusy(false);
    if (r?.error) setError(r.error);
  }

  const chip = (on: boolean) =>
    `h-9 rounded-full border px-4 text-[12px] font-bold ${on ? 'border-brand bg-brand text-white' : 'border-white/15 bg-white/5 text-white/70'}`;
  return (
    <div className="flex flex-col gap-4" data-testid="post-composer">
      {error ? (
        <p
          role="alert"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
          data-testid="post-error"
        >
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1.5 text-[12px] font-bold text-white/70">
        {t('post.article.text', { count: text.length, max: MAX_TEXT })}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          rows={6}
          placeholder={t('post.article.textHint')}
          className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-[14px] font-normal text-white outline-none focus:border-brand"
          style={
            canBg && bg ? { background: bg, textAlign: 'center', fontSize: 20, fontWeight: 800 } : undefined
          }
          data-testid="post-text-input"
        />
      </label>
      {canBg ? (
        <div className="flex items-center gap-2" role="radiogroup" aria-label={t('post.article.bg')}>
          <span className="text-[12px] font-bold text-white/70">{t('post.article.bg')}</span>
          <button
            type="button"
            role="radio"
            aria-checked={!bg}
            onClick={() => setBg(null)}
            className="h-8 w-8 rounded-full border-2 border-white/30 bg-transparent text-[10px]"
          >
            ✕
          </button>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={bg === c}
              aria-label={c}
              onClick={() => setBg(c)}
              className={`h-8 w-8 rounded-full border-2 ${bg === c ? 'border-white' : 'border-transparent'}`}
              style={{ background: c }}
              data-testid={`post-bg-${c.slice(1)}`}
            />
          ))}
        </div>
      ) : null}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-[12px] font-bold text-white/70">
          {t('post.article.images', { count: images.length, max: MAX_IMAGES })}
        </legend>
        {images.length ? (
          <ol className="flex gap-2 overflow-x-auto pb-1" data-testid="post-images-picked">
            {images.map((img, i) => (
              <li key={img.id} className="relative w-24 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt="" className="h-24 w-24 rounded-[12px] object-cover" />
                <div className="mt-1 flex justify-between">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={t('post.edit.moveUp')}
                    className="h-8 w-8 rounded-full bg-white/10 disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setImages((l) => l.filter((x) => x.id !== img.id))}
                    aria-label={t('post.edit.remove')}
                    className="h-8 w-8 rounded-full bg-white/10"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                    aria-label={t('post.edit.moveDown')}
                    className="h-8 w-8 rounded-full bg-white/10 disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {images.length < MAX_IMAGES ? (
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-brand/60 bg-white/5 text-[13px] font-black">
            🖼 {uploading ? t('post.article.uploading', { count: uploading }) : t('post.article.addImages')}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              data-testid="post-image-input"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                void add(files);
              }}
            />
          </label>
        ) : null}
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-[12px] font-bold text-white/70">
          {t('post.products', { count: picked.length })}
        </legend>
        {picked.length ? (
          <ul className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  className="h-8 rounded-full bg-brand px-3 text-[12px] font-bold text-white"
                >
                  {p.name} ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('post.productSearch')}
          className="h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand"
        />
        <ul className="flex flex-col divide-y divide-white/10">
          {results.slice(0, 5).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p)}
                aria-pressed={picked.some((x) => x.id === p.id)}
                className="flex w-full items-center justify-between gap-2 py-2 text-left text-[13px]"
              >
                <span className="min-w-0 truncate font-bold">{p.name}</span>
                <span className="shrink-0 text-white/50">{formatVnd(p.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      {postOptions ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('post.privacy')}>
          {(['public', 'followers', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className={chip(visibility === v)}
            >
              {t(`post.visibility.${v}`)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 flex gap-2 border-t border-white/10 bg-ink/95 px-4 py-3 backdrop-blur-xl">
        {postOptions ? (
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={busy || uploading > 0 || (!text.trim() && !images.length)}
            className="h-12 shrink-0 rounded-full border border-white/20 px-5 font-black text-white disabled:opacity-50"
          >
            {t('post.saveDraft')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void submit(false)}
          disabled={busy || uploading > 0 || (!text.trim() && !images.length)}
          className="h-12 flex-1 rounded-full bg-brand font-black text-white disabled:opacity-50"
          data-testid="post-submit"
        >
          {t('post.article.submit')}
        </button>
      </div>
    </div>
  );
}
