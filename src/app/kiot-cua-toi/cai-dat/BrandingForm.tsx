'use client';

import Image from 'next/image';
import { useState } from 'react';

type Kind = 'logo' | 'cover';

// Tải logo và ảnh bìa ngay khi chọn file; ảnh cũ được thay thế.
export function BrandingForm({ logoUrl, coverUrl }: { logoUrl: string | null; coverUrl: string | null }) {
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
      else setError(data.message ?? 'Tải ảnh thất bại');
    } catch {
      setError('Mất kết nối, hãy thử lại');
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
      <span className="text-sm font-bold">{label}</span>
      <div
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed border-black/20 bg-surface-muted ${box}`}
      >
        {urls[kind] ? (
          <Image src={urls[kind]!} alt={label} fill sizes="400px" className="object-cover" unoptimized />
        ) : null}
      </div>
      <div className="flex gap-3 text-sm">
        <label className="cursor-pointer rounded-full border-2 border-brand-ink px-4 py-1.5 font-bold">
          {busy === kind ? 'Đang tải…' : urls[kind] ? 'Đổi ảnh' : 'Chọn ảnh'}
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
            Gỡ
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
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-[96px_1fr] gap-4">
        {slot('logo', 'Logo', 'h-24 w-24')}
        {slot('cover', 'Ảnh bìa', 'h-24 w-full')}
      </div>
    </div>
  );
}
