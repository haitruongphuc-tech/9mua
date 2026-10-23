'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

export type PickedImage = { id: string; thumbUrl: string };
type Uploading = { key: string; name: string; error?: string };

// Tải từng ảnh lên ngay khi chọn; form chỉ gửi danh sách mã ảnh theo thứ tự hiển thị.
export function ImagePicker({
  initial,
  max,
  error,
  uploadUrl = '/api/kiot/images',
}: {
  initial: PickedImage[];
  max: number;
  error?: string;
  uploadUrl?: string;
}) {
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
            u.map((x) => (x.key === key ? { ...x, error: data.message ?? 'Tải ảnh thất bại' } : x)),
          );
        }
      } catch {
        setUploading((u) => u.map((x) => (x.key === key ? { ...x, error: 'Mất kết nối, hãy thử lại' } : x)));
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
      <legend className="mb-1.5 text-sm font-bold">
        Ảnh sản phẩm ({images.length}/{max}) — ảnh đầu tiên là ảnh bìa
      </legend>
      <ul className="grid grid-cols-3 gap-2" data-testid="image-list">
        {images.map((img, i) => (
          <li
            key={img.id}
            className="relative aspect-square overflow-hidden rounded-xl border-2 border-black/10"
          >
            <input type="hidden" name="imageIds" value={img.id} />
            <Image
              src={img.thumbUrl}
              alt={`Ảnh ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 text-white">
              <button
                type="button"
                aria-label="Chuyển ảnh sang trái"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="px-2 py-1 disabled:opacity-30"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Bỏ ảnh"
                onClick={() => setImages((list) => list.filter((x) => x.id !== img.id))}
                className="px-2 py-1"
              >
                ✕
              </button>
              <button
                type="button"
                aria-label="Chuyển ảnh sang phải"
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
            className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/20 p-2 text-center text-xs"
          >
            {u.error ? (
              <>
                <span className="text-danger">{u.error}</span>
                <button
                  type="button"
                  className="mt-1 underline"
                  onClick={() => setUploading((x) => x.filter((y) => y.key !== u.key))}
                >
                  Đóng
                </button>
              </>
            ) : (
              <span>Đang tải…</span>
            )}
          </li>
        ))}
        {images.length < max ? (
          <li>
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-ink text-sm font-bold">
              <span aria-hidden className="text-2xl">
                ＋
              </span>
              Chọn ảnh
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
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}
