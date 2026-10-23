import Image from 'next/image';
import Link from 'next/link';
import type { VideoThumb } from '@/modules/creator';

export function VideoGrid({ videos, showAuthor = false }: { videos: VideoThumb[]; showAuthor?: boolean }) {
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
