'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { formatVnd } from '@/lib/format';
import type { PickableProduct } from '@/app/api/video/products/route';
import { createVideoAction } from './actions';

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_CAPTION = 300;

function putWithProgress(
  file: File,
  onProgress: (pct: number) => void,
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
        resolve({ ok: false, message: 'Tải lên thất bại, hãy thử lại.' });
      }
    };
    xhr.onerror = () => resolve({ ok: false, message: 'Mất kết nối, hãy thử lại.' });
    xhr.send(file);
  });
}

export function VideoUploadForm({ remaining }: { remaining: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableProduct[]>([]);
  const [picked, setPicked] = useState<PickableProduct[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preview = useRef<HTMLVideoElement>(null);

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
    if (f.size > MAX_BYTES) return setError('Video tối đa 100MB.');
    setFile(f);
    // Kiểm sơ bộ thời lượng trên máy (server kiểm lại bằng ffprobe). Trình duyệt không đọc được thì bỏ qua.
    const url = URL.createObjectURL(f);
    const v = preview.current;
    if (v) {
      v.onloadedmetadata = () => {
        if (v.duration > 60.5) setError('Video dài hơn 60 giây, hãy cắt ngắn rồi đăng lại.');
      };
      v.src = url;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || error) return;
    setProgress(0);
    const up = await putWithProgress(file, setProgress);
    if (!up.ok || !up.uploadId) {
      setProgress(null);
      return setError(up.message ?? 'Tải lên thất bại.');
    }
    const result = await createVideoAction({
      uploadId: up.uploadId,
      caption,
      productIds: picked.map((p) => p.id),
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          data-testid="video-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {error}
        </p>
      ) : null}
      <label className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-ink p-6 text-center font-bold">
        <span aria-hidden className="text-3xl">
          🎬
        </span>
        {file ? file.name : 'Chọn video (≤ 60 giây, ≤ 100MB)'}
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="sr-only"
          data-testid="video-input"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>
      <video
        ref={preview}
        className="mx-auto max-h-64 rounded-xl"
        muted
        playsInline
        controls
        hidden={!file}
      />
      <label className="flex flex-col gap-1.5 text-sm font-bold">
        Chú thích ({caption.length}/{MAX_CAPTION})
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
          rows={3}
          placeholder="Giới thiệu sản phẩm… #thanhlong"
          className="rounded-xl border-2 border-black/15 p-3 font-normal outline-none focus:border-brand-ink"
          data-testid="video-caption"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold">Gắn sản phẩm ({picked.length}/3)</legend>
        {picked.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {picked.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  className="rounded-full bg-brand/15 px-3 py-1 text-sm font-bold"
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
          placeholder="Tìm sản phẩm trên Chợ…"
          className="h-11 rounded-xl border-2 border-black/15 bg-white px-3 outline-none focus:border-brand-ink"
          data-testid="video-product-search"
        />
        <ul className="flex flex-col divide-y divide-black/10" data-testid="video-product-results">
          {results.map((p) => {
            const on = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 py-2 text-left text-sm"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    {p.thumbUrl ? (
                      <Image src={p.thumbUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="text-black/60">
                      {formatVnd(p.price)} · {p.kiotName}
                    </span>
                  </span>
                  <span aria-hidden className="font-bold">
                    {on ? '✓' : '+'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {progress !== null ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="h-3 overflow-hidden rounded-full bg-black/10">
            <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-black/70" data-testid="video-progress">
            {progress < 100 ? `Đang tải lên ${progress}%` : 'Đang lưu…'}
          </span>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={!file || Boolean(error) || progress !== null || remaining <= 0}
        className="h-12 rounded-full border-2 border-brand-ink bg-brand font-extrabold text-brand-ink disabled:opacity-50"
      >
        Đăng video
      </button>
      <p className="text-center text-xs text-black/60">Hôm nay bạn còn đăng được {remaining} video.</p>
    </form>
  );
}
