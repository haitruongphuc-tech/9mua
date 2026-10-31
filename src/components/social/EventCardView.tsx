import Image from 'next/image';
import Link from 'next/link';
import { formatDateTime } from '@/lib/format';
import { provinceName } from '@/modules/kiot';
import type { EventCard } from '@/modules/social';

// Thẻ sự kiện dùng chung (trang /su-kien, khối Sự kiện trên trang cá nhân và trang Kiot).
export function EventCardView({
  event: e,
  lang,
  labels,
}: {
  event: EventCard;
  lang: string;
  labels: { live: string; interested: string };
}) {
  return (
    <Link
      href={`/su-kien/${e.id}`}
      className="flex gap-3 rounded-[16px] border border-white/10 bg-white/5 p-2"
      data-testid="event-card"
    >
      <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[10px] bg-gradient-to-br from-brand/60 to-black">
        {e.coverPath ? (
          <Image src={e.coverPath} alt="" fill sizes="112px" className="object-cover" unoptimized />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14px] font-black">{e.title}</span>
        <span className="block text-[12px] text-brand">{formatDateTime(e.startsAt, lang)}</span>
        <span className="block truncate text-[11px] text-white/60">
          {e.mode === 'live'
            ? `🔴 ${labels.live}`
            : `📍 ${[e.address, e.province ? provinceName(e.province) : null].filter(Boolean).join(', ')}`}
        </span>
        <span className="block text-[11px] text-white/50">
          @{e.ownerName} · {labels.interested}
        </span>
      </span>
    </Link>
  );
}
