import Image from 'next/image';
import Link from 'next/link';
import type { VideoThumb } from '@/modules/creator';
import { HoldPreview } from './HoldPreview';

// pinnedLabel: trang cá nhân hiện nhãn "Ghim" trên video được ghim lên đầu (SPEC-creator.md V5.3).
export function VideoGrid({
  videos,
  showAuthor = false,
  pinnedLabel,
}: {
  videos: VideoThumb[];
  showAuthor?: boolean;
  pinnedLabel?: string;
}) {
  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6" data-testid="video-grid">
      {videos.map((v) => (
        <li key={v.id}>
          <Link
            href={`/v/${v.id}`}
            className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-black"
          >
            {v.posterUrl ? (
              <Image
                src={v.posterUrl}
                alt={v.caption || 'Video'}
                fill
                sizes="(max-width: 640px) 33vw, 16vw"
                className="object-cover"
                unoptimized
              />
            ) : null}
            {v.previewUrl ? <HoldPreview url={v.previewUrl} /> : null}
            {pinnedLabel && v.pinned ? (
              <span
                className="absolute left-1.5 top-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-black"
                data-testid="grid-pinned"
              >
                {pinnedLabel}
              </span>
            ) : null}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-xs font-bold text-white">
              ▶ {v.views.toLocaleString('vi-VN')}
              {showAuthor ? <span className="block truncate font-normal">@{v.authorName}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
