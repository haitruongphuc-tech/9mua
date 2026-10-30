import Link from 'next/link';

// Chữ người dùng có #hashtag và @tên bấm được (SPEC-social.md V5.4 mục 2, SPEC-identity.md V5.1): @tên mở 9mua.com/@tên.
const TOKEN = /(#[\p{L}\p{N}_]+|@[a-z0-9._]{3,30})/giu;

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, k) =>
        part.startsWith('#') && part.length > 1 ? (
          <Link
            key={k}
            href={`/hashtag/${encodeURIComponent(part.slice(1))}`}
            className={className ?? 'font-bold hover:underline'}
          >
            {part}
          </Link>
        ) : part.startsWith('@') && part.length > 3 ? (
          <Link
            key={k}
            href={`/@${part.slice(1).toLowerCase().replace(/\.+$/, '')}`}
            className={className ?? 'font-bold hover:underline'}
            data-testid="mention-link"
          >
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}
