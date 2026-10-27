'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useT } from '@/i18n/client';

export type PickedImage = { id: string; thumbUrl: string };
type Uploading = { key: string; name: string; error?: string };

// Tải từng ảnh lên ngay khi chọn; form chỉ gửi danh sách mã ảnh theo thứ tự hiển thị.
// kind 'product': ảnh sản phẩm (ảnh đầu là ảnh bìa); 'plain': ảnh đính kèm (khiếu nại).
export function ImagePicker({
  initial,
  max,
  error,
  uploadUrl = '/api/kiot/images',
  kind = 'product',
}: {
  initial: PickedImage[];
  max: number;
  error?: string;
  uploadUrl?: string;
  kind?: 'product' | 'plain';
}) {
  const t = useT();
  const [images, setImages] = useState<PickedImage[]>(initial);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const room = max - images.length - uploading.filter((u) => !u.error).length;
    for (const file of Array.from(files).slice(0, Math.max(room, 0))) {
      const key = `${file.name}-${Math.random()}`;
      setUploading((u) => [...u, { key, name: file.name }]);
      const body = new FormData();
      body.append('file', file);
      try {
        const res = await fetch(uploadUrl, { method: 'POST', body });
        const data = (await res.json()) as { ok: boolean; image?: PickedImage; message?: string };
        if (data.ok && data.image) {
          setImages((list) => [...list, data.image!]);
          setUploading((u) => u.filter((x) => x.key !== key));
        } else {
          setUploading((u) =>
            u.map((x) => (x.key === key ? { ...x, error: data.message ?? t('seller.img.failed') } : x)),
          );
        }
      } catch {
        setUploading((u) => u.map((x) => (x.key === key ? { ...x, error: t('seller.img.offline') } : x)));
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(index: number, delta: number) {
    setImages((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(Math.min(Math.max(index + delta, 0), next.length), 0, item!);
      return next;
    });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[12px] font-bold text-white/70">
        {t(kind === 'product' ? 'seller.img.legend' : 'seller.img.legendPlain', {
          count: images.length,
          max,
        })}
      </legend>
      <ul className="grid grid-cols-3 gap-2" data-testid="image-list">
        {images.map((img, i) => (
          <li
            key={img.id}
            className="relative aspect-square overflow-hidden rounded-[14px] border border-white/10"
          >
            <input type="hidden" name="imageIds" value={img.id} />
            <Image
              src={img.thumbUrl}
              alt={t('seller.img.alt', { n: i + 1 })}
              fill
              sizes="120px"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 text-white">
              <button
                type="button"
                aria-label={t('seller.img.left')}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="px-2 py-1 disabled:opacity-30"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label={t('seller.img.remove')}
                onClick={() => setImages((list) => list.filter((x) => x.id !== img.id))}
                className="px-2 py-1"
              >
                ✕
              </button>
              <button
                type="button"
                aria-label={t('seller.img.right')}
                disabled={i === images.length - 1}
                onClick={() => move(i, 1)}
                className="px-2 py-1 disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          </li>
        ))}
        {uploading.map((u) => (
          <li
            key={u.key}
            className="flex aspect-square flex-col items-center justify-center rounded-[14px] border border-dashed border-white/20 p-2 text-center text-[11px]"
          >
            {u.error ? (
              <>
                <span className="text-red-400">{u.error}</span>
                <button
                  type="button"
                  className="mt-1 underline"
                  onClick={() => setUploading((x) => x.filter((y) => y.key !== u.key))}
                >
                  {t('seller.img.close')}
                </button>
              </>
            ) : (
              <span>{t('seller.img.uploading')}</span>
            )}
          </li>
        ))}
        {images.length < max ? (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-brand/50 bg-white/5 text-[13px] font-bold">
              <span aria-hidden className="text-2xl text-brand">
                ＋
              </span>
              {t('seller.img.choose')}
              <input
                ref={inputRef}
                type="file"
                // Không nhận HEIC: iPhone tự đổi sang JPEG (xem SPEC-kiot.md).
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                data-testid="image-input"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          </li>
        ) : null}
      </ul>
      {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
    </fieldset>
  );
}
