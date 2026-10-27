'use client';

import { Clapperboard, House, Plus, Store, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Thanh điều hướng 5 nút cuối màn hình điện thoại, kiểu TikTok (docs/v4-merge-plan.md, T39). Máy tính dùng thanh
// trên. base: '' trên 9mua.com; APP_URL trên trang Kiot (link về tên miền chính, không tô sáng nút nào).
export function BottomNav({ base = '' }: { base?: string }) {
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'Trang chủ', Icon: House },
    { href: '/cho', label: 'Chợ', Icon: Store },
    { href: '/video/dang', label: 'Đăng video', Icon: Plus, center: true },
    { href: '/video', label: 'Video', Icon: Clapperboard },
    { href: '/tai-khoan', label: 'Tôi', Icon: UserRound },
  ];
  const isActive = (href: string) =>
    !base &&
    (href === '/'
      ? pathname === '/'
      : href === '/video'
        ? pathname === '/video' || pathname.startsWith('/v/')
        : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {items.map(({ href, label, Icon, center }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={`${base}${href}`}
                aria-current={active ? 'page' : undefined}
                className={`flex w-16 flex-col items-center gap-0.5 text-[11px] font-bold ${
                  active ? 'text-brand-deep' : 'text-black/60'
                }`}
              >
                {center ? (
                  <span className="grid h-8 w-12 place-items-center rounded-xl border-2 border-brand-ink bg-brand text-brand-ink">
                    <Icon className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : (
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
                )}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
