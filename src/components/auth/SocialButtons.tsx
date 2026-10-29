import { GoogleIcon } from '@/components/GoogleIcon';

export type SocialModes = { zalo: boolean; google: boolean; facebook: boolean };

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

// Nút Zalo · Google · Facebook (SPEC-identity.md bổ sung 29/10). Nút nào chưa cấu hình khoá thì ẩn.
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
  labels: { zalo: string; google: string; facebook: string };
}) {
  const items = (
    [
      ['zalo', ZaloIcon],
      ['google', GoogleIcon],
      ['facebook', FacebookIcon],
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
