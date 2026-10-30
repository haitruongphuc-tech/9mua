'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { PickableProduct } from '@/app/api/video/products/route';
import type { VideoForEdit } from '@/modules/creator';
import { editVideoAction } from './actions';

type Picked = { id: string; name: string; price: number; thumbUrl: string | null };

// Sửa chú thích, sản phẩm gắn, quyền riêng tư, địa điểm, nhãn AI, bình luận / Duet / tải về (SPEC-creator.md V5.3).
export function EditVideoForm({
  video,
  provinces,
}: {
  video: VideoForEdit;
  provinces: { slug: string; name: string }[];
}) {
  const t = useT();
  const [caption, setCaption] = useState(video.caption);
  const [picked, setPicked] = useState<Picked[]>(video.products);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableProduct[]>([]);
  const [visibility, setVisibility] = useState(video.visibility);
  const [allow, setAllow] = useState({
    allowComments: video.allowComments,
    allowRemix: video.allowRemix,
    allowDownload: video.allowDownload,
  });
  const [province, setProvince] = useState(video.province ?? '');
  const [placeName, setPlaceName] = useState(video.placeName ?? '');
  const [aiUsed, setAiUsed] = useState(video.aiGenerated);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Ảnh bìa (SPEC-creator.md V5.1 mục 6): chọn 1 trong 3 ảnh gợi ý hoặc tải ảnh riêng; đổi ngay, không cần bấm Lưu.
  const [poster, setPoster] = useState(video.posterUrl);
  const [coverMsg, setCoverMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function changeCover(body: { choice: string } | { file: File }) {
    setCoverMsg(null);
    const form = new FormData();
    form.set('videoId', video.id);
    if ('choice' in body) form.set('choice', body.choice);
    else form.set('file', body.file);
    const res = (await fetch('/api/video/cover', { method: 'POST', body: form })
      .then((r) => r.json())
      .catch(() => null)) as { ok: boolean; posterUrl?: string } | null;
    if (res?.ok && res.posterUrl) {
      setPoster(res.posterUrl);
      setCoverMsg({ ok: true, text: t('post.coverSaved') });
    } else setCoverMsg({ ok: false, text: t('post.coverError') });
  }

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

  const toggle = (p: Picked) =>
    setPicked((list) =>
      list.some((x) => x.id === p.id)
        ? list.filter((x) => x.id !== p.id)
        : list.length < 3
          ? [...list, p]
          : list,
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await editVideoAction({
      videoId: video.id,
      caption,
      productIds: picked.map((p) => p.id),
      visibility,
      ...allow,
      province,
      placeName,
      aiGenerated: aiUsed,
    });
    setSaving(false);
    if (result?.error) setError(result.error);
  }

  const field =
    'rounded-[14px] border border-white/15 bg-white/10 p-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-brand';
  return (
    <form
      onSubmit={submit}
      // Ô nhập và nút trong các nhóm (không phải nút đăng ở thanh dính) được cuộn tới phải nằm trên thanh nút dính ở đáy và menu dưới.
      className="flex flex-col gap-4 [&_fieldset]:min-w-0 [&_fieldset_button]:scroll-mb-44 [&_input]:scroll-mb-44 [&_select]:scroll-mb-44 [&_textarea]:scroll-mb-44"
      data-testid="edit-video-form"
    >
      <fieldset className="flex flex-col gap-2" data-testid="edit-cover">
        <legend className="mb-1 text-[12px] font-bold text-white/70">{t('post.cover')}</legend>
        <div className="flex gap-2 overflow-x-auto">
          {[...new Set([poster, ...video.posterChoices].filter((u): u is string => Boolean(u)))].map(
            (url) => (
              <button
                key={url}
                type="button"
                onClick={() => url !== poster && void changeCover({ choice: url })}
                aria-pressed={url === poster}
                aria-label={t('post.coverPick')}
                disabled={url !== poster && !video.posterChoices.includes(url)}
                className={`relative h-28 w-16 shrink-0 overflow-hidden rounded-[10px] border-2 ${
                  url === poster ? 'border-brand' : 'border-transparent'
                }`}
                data-testid="cover-choice"
              >
                <Image src={url} alt="" fill sizes="64px" className="object-cover" unoptimized />
              </button>
            ),
          )}
          <label className="flex h-28 w-16 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-dashed border-white/30 text-center text-[11px] font-bold text-white/70">
            {t('post.coverUpload')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              data-testid="cover-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void changeCover({ file: f });
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {coverMsg ? (
          <p
            role={coverMsg.ok ? 'status' : 'alert'}
            className={`text-[12px] font-bold ${coverMsg.ok ? 'text-green-300' : 'text-red-400'}`}
          >
            {coverMsg.text}
          </p>
        ) : null}
      </fieldset>
      <label className="flex flex-col gap-2 text-[13px] font-bold">
        {t('post.caption')}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={300}
          rows={3}
          className={`${field} font-normal`}
          data-testid="edit-caption"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12px] font-bold text-white/70">{t('post.privacy')}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(['public', 'followers', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              onClick={() => setVisibility(v)}
              className={`h-9 rounded-full border px-4 text-[12px] font-bold ${
                visibility === v
                  ? 'border-brand bg-brand text-white'
                  : 'border-white/15 bg-white/5 text-white/70'
              }`}
            >
              {t(`post.visibility.${v}`)}
            </button>
          ))}
        </div>
        {(['allowComments', 'allowRemix', 'allowDownload'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={allow[k]}
              onChange={(e) => setAllow((a) => ({ ...a, [k]: e.target.checked }))}
              className="h-4 w-4 accent-[#ff6b00]"
            />
            {t(`post.${k}`)}
          </label>
        ))}
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={aiUsed}
            disabled={video.aiStudio}
            onChange={(e) => setAiUsed(e.target.checked)}
            className="h-4 w-4 accent-[#ff6b00]"
            data-testid="edit-ai"
          />
          {t('post.aiUsed')}
          {video.aiStudio ? <span className="text-white/50">· {t('post.aiStudioLocked')}</span> : null}
        </label>
      </fieldset>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('post.province')}
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={`${field} h-11 w-full min-w-0 py-0 font-normal`}
            data-testid="edit-province"
          >
            <option value="">{t('post.noPlace')}</option>
            {provinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('post.placeName')}
          <input
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            maxLength={60}
            placeholder={t('post.placeNameHint')}
            className={`${field} h-11 w-full min-w-0 py-0 font-normal`}
            data-testid="edit-place"
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[12px] font-bold text-white/70">
          {t('post.products', { count: picked.length })}
        </legend>
        {picked.length > 0 ? (
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
          className={`${field} h-11 rounded-full px-4 py-0`}
        />
        <ul className="flex flex-col divide-y divide-white/10">
          {results.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 py-2 text-left text-[13px]"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
                    {p.thumbUrl ? (
                      <Image src={p.thumbUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="text-white/50">
                      {formatVnd(p.price)} · {p.kiotName}
                    </span>
                  </span>
                  <span aria-hidden className={`font-black ${on ? 'text-brand' : ''}`}>
                    {on ? '✓' : '+'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {error ? (
        <p role="alert" className="text-[13px] font-bold text-red-400">
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-white/10 bg-ink/95 px-4 py-3 backdrop-blur-xl">
        <button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-full bg-brand font-black text-white disabled:opacity-50"
          data-testid="edit-save"
        >
          {t('post.editSave')}
        </button>
      </div>
    </form>
  );
}
