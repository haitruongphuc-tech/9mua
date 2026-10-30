'use client';

import { Repeat2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useFeature } from '@/components/MeProvider';
import { useT } from '@/i18n/client';
import { formatVnd } from '@/lib/format';
import type { PickableProduct } from '@/app/api/video/products/route';
import { createVideoAction } from './actions';
import { chunkedUpload, type UploadProgress } from './chunked-upload';

const MAX_CAPTION = 300;
const STORY_SEC = 30;
type Mode = 'video' | 'story';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
const clockText = (sec: number) =>
  sec >= 3600
    ? `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
    : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function putWithProgress(
  file: File,
  onProgress: (pct: number) => void,
  messages: { failed: string; offline: string },
): Promise<{ ok: boolean; uploadId?: string; message?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', '/api/video/upload');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ ok: false, message: messages.failed });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: messages.offline });
    xhr.send(file);
  });
}

export function VideoUploadForm({
  remaining,
  initialMode,
  duet,
  provinces,
  defaultProvince,
  limits,
}: {
  remaining: Record<Mode, number>;
  initialMode: Mode;
  duet: { id: string; author: string; posterUrl: string | null } | null;
  provinces: { slug: string; name: string }[];
  defaultProvince: string;
  // Giới hạn theo công tắc long_video (SPEC-creator.md V5.1). Bật thì tải từng phần 8MB, gửi tiếp được khi rớt mạng.
  limits: { long: boolean; maxBytes: number; maxSec: number };
}) {
  const maxSec = (m: Mode) => (m === 'story' ? STORY_SEC : limits.maxSec);
  const t = useT();
  // Duet luôn là video thường.
  const [mode, setMode] = useState<Mode>(duet ? 'video' : initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableProduct[]>([]);
  const [picked, setPicked] = useState<PickableProduct[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [detail, setDetail] = useState<UploadProgress | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  // Quyền riêng tư và tuỳ chọn khi đăng (SPEC-creator.md V5.3, công tắc post_options).
  const postOptions = useFeature('post_options');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [allow, setAllow] = useState({ allowComments: true, allowRemix: true, allowDownload: true });
  // Địa điểm (mặc định tỉnh của Kiot), nhãn AI, hẹn giờ (giờ Việt Nam) — SPEC-creator.md V5.3.
  const [province, setProvince] = useState(defaultProvince);
  const [placeName, setPlaceName] = useState('');
  const [aiUsed, setAiUsed] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/video/products?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { items: PickableProduct[] }) => setResults(d.items))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    setDurationSec(null);
    if (f.size > limits.maxBytes)
      return setError(
        limits.long
          ? t('post.err.tooBigMb', { mb: Math.round(limits.maxBytes / 1024 / 1024) })
          : t('post.err.tooBig'),
      );
    setFile(f);
    // Kiểm sơ bộ thời lượng trên máy (server kiểm lại bằng ffprobe). Trình duyệt không đọc được thì bỏ qua.
    const url = URL.createObjectURL(f);
    const v = preview.current;
    if (v) {
      v.onloadedmetadata = () => {
        if (Number.isFinite(v.duration)) setDurationSec(v.duration);
        if (v.duration > maxSec(mode) + 0.5) setError(t('post.err.tooLong', { sec: maxSec(mode) }));
      };
      v.src = url;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || error) return;
    const asDraft = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'draft';
    setProgress(0);
    const messages = { failed: t('post.err.upload'), offline: t('post.err.offline') };
    const up = limits.long
      ? await chunkedUpload(
          file,
          durationSec,
          (p) => {
            setProgress(p.pct);
            setDetail(p);
          },
          messages,
        )
      : await putWithProgress(file, setProgress, messages);
    setDetail(null);
    if (!up.ok || !up.uploadId) {
      setProgress(null);
      return setError(up.message ?? t('post.err.upload'));
    }
    const result = await createVideoAction({
      uploadId: up.uploadId,
      caption,
      productIds: picked.map((p) => p.id),
      kind: mode,
      duetOfId: duet?.id ?? null,
      options:
        postOptions && mode === 'video'
          ? {
              visibility,
              ...allow,
              province,
              placeName,
              aiGenerated: aiUsed,
              draft: asDraft,
              publishAt: !asDraft && scheduleAt ? `${scheduleAt}:00+07:00` : null,
            }
          : undefined,
    });
    setProgress(null);
    if (result?.error) setError(result.error);
  }

  const toggle = (p: PickableProduct) =>
    setPicked((list) =>
      list.some((x) => x.id === p.id)
        ? list.filter((x) => x.id !== p.id)
        : list.length < 3
          ? [...list, p]
          : list,
    );

  const field =
    'rounded-[14px] border border-white/15 bg-white/10 p-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-brand';
  return (
    <form
      onSubmit={submit}
      // Ô nhập được cuộn tới phải nằm trên thanh nút dính ở đáy và menu dưới (không bị che trên điện thoại).
      className="flex flex-col gap-4 [&_input]:scroll-mb-44 [&_select]:scroll-mb-44 [&_textarea]:scroll-mb-44"
    >
      {duet ? (
        <div
          className="flex items-center gap-3 rounded-[16px] border border-brand/40 bg-white/5 p-3"
          data-testid="duet-banner"
        >
          <span className="relative h-16 w-10 shrink-0 overflow-hidden rounded-[8px] bg-black">
            {duet.posterUrl ? (
              <Image src={duet.posterUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-black">
              <Repeat2 className="h-4 w-4 text-brand" aria-hidden />{' '}
              {t('post.duetWith', { name: duet.author })}
            </span>
            <span className="block text-[12px] text-white/60">{t('post.duetHint')}</span>
          </span>
        </div>
      ) : (
        <div className="flex gap-2" role="radiogroup">
          {(['video', 'story'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`h-9 rounded-full border px-4 text-[12px] font-bold ${
                mode === m ? 'border-brand bg-brand text-white' : 'border-white/15 bg-white/5 text-white/70'
              }`}
            >
              {t(m === 'video' ? 'post.mode.video' : 'post.mode.story')}
            </button>
          ))}
        </div>
      )}
      {mode === 'story' ? <p className="text-[12px] text-white/60">{t('post.storyHint')}</p> : null}
      {error ? (
        <p
          role="alert"
          data-testid="video-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {error}
        </p>
      ) : null}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-brand/60 bg-white/5 p-6 text-center font-bold">
        <span aria-hidden className="text-3xl">
          🎬
        </span>
        {file ? file.name : t('post.pick', { sec: maxSec(mode) })}
        <input
          type="file"
          accept={
            limits.long
              ? 'video/mp4,video/quicktime,video/webm,video/x-msvideo,.avi'
              : 'video/mp4,video/quicktime,video/webm'
          }
          className="sr-only"
          data-testid="video-input"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>
      <video
        ref={preview}
        className="mx-auto max-h-64 rounded-[14px]"
        muted
        playsInline
        controls
        hidden={!file}
      />
      <label className="flex flex-col gap-1.5 text-[12px] font-bold text-white/70">
        {t('post.caption', { count: caption.length, max: MAX_CAPTION })}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
          rows={3}
          placeholder={t('post.captionPlaceholder')}
          className={`${field} font-normal`}
          data-testid="video-caption"
        />
      </label>
      {postOptions && mode === 'video' ? (
        <fieldset className="flex flex-col gap-2" data-testid="video-privacy">
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
              onChange={(e) => setAiUsed(e.target.checked)}
              className="h-4 w-4 accent-[#ff6b00]"
              data-testid="video-ai"
            />
            {t('post.aiUsed')}
          </label>
          <div className="mt-2 grid grid-cols-[2fr_3fr] gap-2">
            <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
              {t('post.province')}
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={`${field} h-11 py-0 font-normal`}
                data-testid="video-province"
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
                className={`${field} h-11 py-0 font-normal`}
                data-testid="video-place"
              />
            </label>
          </div>
          <label className="mt-2 flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('post.schedule')}
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              className={`${field} h-11 py-0 font-normal`}
              data-testid="video-schedule"
            />
            <span className="font-normal text-white/50">{t('post.scheduleHint')}</span>
          </label>
        </fieldset>
      ) : null}
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
          data-testid="video-product-search"
        />
        <ul className="flex flex-col divide-y divide-white/10" data-testid="video-product-results">
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
      {/* Nút đăng luôn nằm ở đáy màn hình, ngay trên thanh menu dưới: trên iPhone form dài (khung xem trước, danh
          sách sản phẩm) nên nút cuối form bị khuất, người dùng chọn video xong không thấy chỗ bấm đăng. */}
      <div className="sticky bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 flex flex-col gap-2 border-t border-white/10 bg-ink/95 px-4 py-3 backdrop-blur-xl">
        {progress !== null ? (
          <div className="flex flex-col gap-1" aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[12px] text-white/60" data-testid="video-progress">
              {progress >= 100
                ? t('post.saving')
                : detail && detail.bytesPerSec > 0 && detail.etaSec !== null
                  ? t('post.uploadingDetail', {
                      pct: progress,
                      speed: mb(detail.bytesPerSec),
                      eta: clockText(detail.etaSec),
                    })
                  : t('post.uploading', { pct: progress })}
            </span>
          </div>
        ) : null}
        <div className="flex gap-2">
          {postOptions && mode === 'video' ? (
            <button
              type="submit"
              value="draft"
              disabled={!file || Boolean(error) || progress !== null || remaining[mode] <= 0}
              className="h-12 shrink-0 rounded-full border border-white/20 px-5 font-black text-white disabled:opacity-50"
              data-testid="video-save-draft"
            >
              {t('post.saveDraft')}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!file || Boolean(error) || progress !== null || remaining[mode] <= 0}
            className="h-12 flex-1 rounded-full bg-brand font-black text-white shadow-[0_0_20px_rgb(255_107_0/0.35)] disabled:opacity-50"
          >
            {t(
              mode === 'story'
                ? 'post.submitStory'
                : postOptions && scheduleAt
                  ? 'post.submitScheduled'
                  : 'post.submit',
            )}
          </button>
        </div>
        {/* Nút chưa bấm được thì nói lý do ngay dưới nút (lỗi video quá dài/quá nặng cũng hiện ở đây). */}
        <p className="text-center text-[12px] text-white/50" data-testid="video-submit-hint">
          {!file && remaining[mode] > 0
            ? t('post.pickFirst')
            : error && progress === null
              ? error
              : t(mode === 'story' ? 'post.remainingStory' : 'post.remaining', { count: remaining[mode] })}
        </p>
      </div>
    </form>
  );
}
