import Link from 'next/link';

// Chữ giới thiệu có hashtag bấm được (mở /hashtag/<tag>), giống chú thích video trên feed.
export function HashtagText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p className={`whitespace-pre-line ${className}`}>
      {text.split(/(#[\p{L}\p{N}_]+)/u).map((part, i) =>
        part.startsWith('#') ? (
          <Link
            key={i}
            href={`/hashtag/${encodeURIComponent(part.slice(1))}`}
            className="font-bold text-brand"
          >
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </p>
  );
}
