'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ME_CHANGED_EVENT } from '@/components/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { useT } from '@/i18n/client';

type Kind = 'avatar' | 'cover';

// Ảnh đại diện + ảnh bìa trang cá nhân: tải ngay khi chọn file, ảnh cũ bị thay (SPEC-social.md bổ sung 30/10, A2).
export function ProfileImagesForm({
  name,
  avatarUrl,
  coverUrl,
}: {
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
}) {
  const t = useT();
  const [urls, setUrls] = useState<Record<Kind, string | null>>({ avatar: avatarUrl, cover: coverUrl });
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
      const res = await fetch('/api/tai-khoan/anh', { method: 'POST', body });
      const data = (await res.json()) as { ok: boolean; url?: string; message?: string };
      if (data.ok && data.url) {
        setUrls((u) => ({ ...u, [kind]: data.url! }));
        if (kind === 'avatar') window.dispatchEvent(new Event(ME_CHANGED_EVENT));
      } else setError(data.message ?? t('seller.img.failed'));
    } catch {
      setError(t('seller.img.offline'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: Kind) {
    setBusy(kind);
    await fetch(`/api/tai-khoan/anh?kind=${kind}`, { method: 'DELETE' }).catch(() => {});
    setUrls((u) => ({ ...u, [kind]: null }));
    if (kind === 'avatar') window.dispatchEvent(new Event(ME_CHANGED_EVENT));
    setBusy(null);
  }

  const buttons = (kind: Kind) => (
    <div className="flex flex-wrap gap-3 text-[13px]">
      <label className="cursor-pointer rounded-full border border-white/25 px-4 py-1.5 font-bold">
        {busy === kind ? t('profile.edit.uploading') : urls[kind] ? t('profile.edit.change') : t('profile.edit.choose')}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          data-testid={`profile-${kind}-input`}
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
          data-testid={`profile-${kind}-remove`}
        >
          {t('profile.edit.remove')}
        </button>
      ) : null}
    </div>
  );

  return (
    <section className="flex flex-col gap-4 rounded-[18px] border border-white/10 bg-white/5 p-5" id="anh">
      {error ? (
        <p
          role="alert"
          data-testid="profile-image-error"
          className="rounded-[14px] bg-danger/15 px-4 py-3 text-[13px] font-bold text-danger"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold text-white/70">{t('profile.edit.cover')}</span>
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-[14px] border border-dashed border-white/20 bg-gradient-to-br from-brand/40 to-ink">
          {urls.cover ? (
            <Image
              src={urls.cover}
              alt=""
              fill
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
              unoptimized
              data-testid="profile-cover-preview"
            />
          ) : null}
        </div>
        {buttons('cover')}
      </div>
      <div className="flex items-center gap-4">
        <span data-testid="profile-avatar-preview" data-url={urls.avatar ?? ''}>
          <Avatar name={name} url={urls.avatar} className="h-20 w-20 text-[28px]" />
        </span>
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold text-white/70">{t('profile.edit.avatar')}</span>
          {buttons('avatar')}
        </div>
      </div>
      <p className="text-[12px] text-white/50">{t('profile.edit.imageHint')}</p>
    </section>
  );
}
