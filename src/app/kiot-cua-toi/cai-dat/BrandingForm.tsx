'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useT } from '@/i18n/client';

type Kind = 'logo' | 'cover';

// Tải logo và ảnh bìa ngay khi chọn file; ảnh cũ được thay thế.
export function BrandingForm({ logoUrl, coverUrl }: { logoUrl: string | null; coverUrl: string | null }) {
  const t = useT();
  const [urls, setUrls] = useState<Record<Kind, string | null>>({ logo: logoUrl, cover: coverUrl });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(kind: Kind, file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    try {
      const res = await fetch('/api/kiot/branding', { method: 'POST', body });
      const data = (await res.json()) as { ok: boolean; url?: string; message?: string };
      if (data.ok && data.url) setUrls((u) => ({ ...u, [kind]: data.url! }));
      else setError(data.message ?? t('seller.img.failed'));
    } catch {
      setError(t('seller.img.offline'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: Kind) {
    setBusy(kind);
    await fetch(`/api/kiot/branding?kind=${kind}`, { method: 'DELETE' }).catch(() => {});
    setUrls((u) => ({ ...u, [kind]: null }));
    setBusy(null);
  }

  const slot = (kind: Kind, label: string, box: string) => (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-bold text-white/70">{label}</span>
      <div
        className={`relative overflow-hidden rounded-[16px] border border-dashed border-white/20 bg-white/5 ${box}`}
      >
        {urls[kind] ? (
          <Image src={urls[kind]!} alt={label} fill sizes="400px" className="object-cover" unoptimized />
        ) : null}
      </div>
      <div className="flex gap-3 text-[13px]">
        <label className="cursor-pointer rounded-full border border-white/25 px-4 py-1.5 font-bold">
          {busy === kind
            ? t('seller.img.uploading')
            : urls[kind]
              ? t('seller.brand.change')
              : t('seller.img.choose')}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            data-testid={`${kind}-input`}
            disabled={busy !== null}
            onChange={(e) => upload(kind, e.target.files?.[0])}
          />
        </label>
        {urls[kind] ? (
          <button
            type="button"
            className="font-bold underline"
            onClick={() => remove(kind)}
            disabled={busy !== null}
          >
            {t('seller.brand.remove')}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          data-testid="branding-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-[96px_1fr] gap-4">
        {slot('logo', t('seller.brand.logo'), 'h-24 w-24')}
        {slot('cover', t('seller.brand.cover'), 'h-24 w-full')}
      </div>
    </div>
  );
}
