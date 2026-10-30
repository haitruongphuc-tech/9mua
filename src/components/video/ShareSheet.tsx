'use client';

import { Link2, MessageCircle, Share2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/client';
import { Sheet } from './Sheet';

// Chia sẻ kiểu V4 (SPEC-creator.md bổ sung 27/10): Facebook, Messenger (điện thoại), sao chép link, chia sẻ của
// điện thoại (gồm Zalo), và mã QR. Video có thêm TikTok/Instagram, tải về, nhúng, gửi qua Hộp thư (V5.7).
export function ShareSheet({
  url,
  title,
  heading,
  qrHint,
  onClose,
  onCopied,
  extra,
}: {
  url: string | null;
  title: string;
  heading?: string; // mặc định "Chia sẻ video"; trang Kiot/creator truyền chữ riêng
  qrHint?: string;
  onClose: () => void;
  onCopied: () => void;
  extra?: ReactNode; // video: TikTok/Instagram, tải về, nhúng, gửi qua Hộp thư (ShareMore, SPEC-creator.md V5.7)
}) {
  const t = useT();
  const [mobile, setMobile] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => {
    setMobile(/Android|iPhone|iPad/i.test(navigator.userAgent));
    setNative(typeof navigator.share === 'function');
  }, []);
  if (!url) return null;
  const enc = encodeURIComponent(url);
  const circle = 'grid h-12 w-12 place-items-center rounded-full text-white font-black text-[13px]';
  const targets = [
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      cls: 'bg-[#1877F2]',
      icon: 'f',
    },
    ...(mobile
      ? [{ name: 'Messenger', href: `fb-messenger://share/?link=${enc}`, cls: 'bg-[#0084FF]', icon: null }]
      : []),
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    onCopied();
  };
  return (
    <Sheet open onClose={onClose} title={heading ?? t('feed.share.title')} testId="share-sheet">
      <div className="grid grid-cols-4 gap-3">
        {targets.map((x) => (
          <a
            key={x.name}
            href={x.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1"
          >
            <span className={`${circle} ${x.cls}`}>
              {x.icon ?? <MessageCircle className="h-5 w-5" aria-hidden />}
            </span>
            <span className="text-[11px] font-bold">{x.name}</span>
          </a>
        ))}
        <button type="button" onClick={copy} className="flex flex-col items-center gap-1">
          <span className={`${circle} bg-black`}>
            <Link2 className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-[11px] font-bold">{t('feed.share.copy')}</span>
        </button>
        {native ? (
          <button
            type="button"
            onClick={() => void navigator.share({ url, title }).catch(() => {})}
            className="flex flex-col items-center gap-1"
          >
            <span className={`${circle} bg-zinc-500`}>
              <Share2 className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-[11px] font-bold">{t('feed.share.more')}</span>
          </button>
        ) : null}
      </div>
      {extra}
      <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-zinc-50 p-3">
        <Image
          src={`/api/qr?u=${enc}`}
          alt="QR"
          width={96}
          height={96}
          unoptimized
          className="rounded-[12px] bg-white"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-zinc-500">{qrHint ?? t('feed.share.qr')}</p>
          <p className="truncate text-[12px] font-bold" data-testid="share-url">
            {url}
          </p>
        </div>
      </div>
    </Sheet>
  );
}
