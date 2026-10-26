'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

type GalleryImage = { id: string; url: string; thumbUrl: string };

// Ảnh sản phẩm: vuốt ngang trên điện thoại; bấm ảnh nhỏ bên dưới để chuyển ảnh (tiện trên máy tính).
export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const offsets = () => [...(list.current?.children ?? [])].map((c) => (c as HTMLElement).offsetLeft);

  function show(i: number) {
    const el = list.current;
    if (!el) return;
    el.scrollTo({ left: offsets()[i]! - offsets()[0]!, behavior: 'smooth' });
    setActive(i);
  }

  function onScroll() {
    const el = list.current;
    if (!el) return;
    const left = el.scrollLeft + offsets()[0]!;
    const all = offsets();
    setActive(all.reduce((best, x, i) => (Math.abs(x - left) < Math.abs(all[best]! - left) ? i : best), 0));
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <ul
        ref={list}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto"
        aria-label="Ảnh sản phẩm"
      >
        {images.map((img, i) => (
          <li
            key={img.id}
            className="relative aspect-square w-full shrink-0 snap-center overflow-hidden rounded-2xl bg-surface-muted"
          >
            <Image
              src={img.url}
              alt={`${name} — ảnh ${i + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
              priority={i === 0}
              unoptimized
            />
          </li>
        ))}
      </ul>
      {images.length > 1 ? (
        <div className="flex gap-2" data-testid="product-thumbs">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => show(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === active}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === active ? 'border-brand-ink' : 'border-transparent opacity-70'
              }`}
            >
              <Image src={img.thumbUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
