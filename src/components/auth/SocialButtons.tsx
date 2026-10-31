import { GoogleIcon } from '@/components/GoogleIcon';

export type SocialModes = { zalo: boolean; google: boolean; facebook: boolean; apple: boolean };

function ZaloIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <rect width="48" height="48" rx="12" fill="#0068FF" />
      <text x="24" y="31" textAnchor="middle" fontSize="17" fontWeight="800" fontFamily="Arial" fill="#fff">
        Zalo
      </text>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#1877F2" />
      <path
        fill="#fff"
        d="M26.5 38V26.8h3.8l.6-4.4h-4.4v-2.8c0-1.3.4-2.1 2.2-2.1h2.3v-3.9c-.4-.1-1.8-.2-3.4-.2-3.3 0-5.6 2-5.6 5.8v3.2h-3.8v4.4H22V38h4.5Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.31-3.55ZM14.18 6.13c.61-.74 1.02-1.76.91-2.78-.88.04-1.94.59-2.57 1.32-.56.65-1.06 1.69-.93 2.69.98.08 1.98-.5 2.59-1.23Z"
      />
    </svg>
  );
}

// Nút Zalo · Google · Facebook · Apple (SPEC-identity.md bổ sung 29/10). Nút nào chưa cấu hình khoá thì ẩn.
// Dùng được ở trang máy chủ và trong popup (không gọi hàm máy chủ).
export function SocialButtons({
  modes,
  next,
  tone = 'dark',
  labels,
}: {
  modes: SocialModes;
  next: string;
  tone?: 'dark' | 'sheet';
  labels: { zalo: string; google: string; facebook: string; apple: string };
}) {
  const items = (
    [
      ['zalo', ZaloIcon],
      ['google', GoogleIcon],
      ['facebook', FacebookIcon],
      ['apple', AppleIcon],
    ] as const
  ).filter(([p]) => modes[p]);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {items.map(([p, Icon]) => (
        <a
          key={p}
          href={`/api/auth/${p}/start?next=${encodeURIComponent(next)}`}
          className={`flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-bold ${
            tone === 'dark' ? 'bg-white text-black' : 'border border-black/10 text-zinc-900 hover:bg-zinc-50'
          }`}
          data-testid={`social-${p}`}
        >
          <Icon />
          {labels[p]}
        </a>
      ))}
    </div>
  );
}
