'use client';

import { Clapperboard, Plus, ShoppingBasket, Store, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/client';
import { useMe } from './MeProvider';

// Thanh dưới 5 nút theo V4, hiện trên mọi màn hình (docs/BRAND.md; CEO chốt 27/10/2026, §7 mục 11):
// Video (trang chủ) · Chợ · Live (nút giữa) · Kiot · Tôi.
// base: '' trên 9mua.com; APP_URL trên trang Kiot (link về tên miền chính, không tô sáng nút nào).
const starts = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const ACCOUNT_PATHS = [
  '/tai-khoan',
  '/don-mua',
  '/kiot-cua-toi',
  '/thong-bao',
  '/video/dang',
  '/video/cua-toi',
];

export function BottomNav({ base = '' }: { base?: string }) {
  const pathname = usePathname();
  const { me, notifications } = useMe();
  const t = useT();
  const onAccount = ACCOUNT_PATHS.some((p) => starts(pathname, p));
  const items = [
    {
      href: '/',
      key: 'video',
      label: t('common.nav.video'),
      Icon: Clapperboard,
      active: pathname === '/' || (starts(pathname, '/video') && !onAccount),
    },
    {
      href: '/cho',
      key: 'market',
      label: t('common.nav.market'),
      Icon: ShoppingBasket,
      active: starts(pathname, '/cho') && !starts(pathname, '/cho/kiot'),
    },
    {
      href: '/live',
      key: 'live',
      label: t('common.nav.live'),
      Icon: Plus,
      center: true,
      active: starts(pathname, '/live'),
    },
    {
      href: '/cho/kiot',
      key: 'kiot',
      label: t('common.nav.kiot'),
      Icon: Store,
      active: starts(pathname, '/cho/kiot'),
    },
    {
      href: me === null ? '/dang-nhap?next=%2Ftai-khoan' : '/tai-khoan',
      key: 'me',
      label: t('common.nav.me'),
      Icon: User,
      active: onAccount,
    },
  ];

  return (
    <nav
      aria-label={t('common.nav.label')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] text-white backdrop-blur-xl"
    >
      <ul className="mx-auto flex h-16 max-w-[560px] items-center justify-around px-2">
        {items.map(({ href, key, label, Icon, center, active: on }) => {
          const active = !base && on;
          return (
            <li key={key}>
              {center ? (
                <Link
                  href={`${base}${href}`}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center"
                >
                  <span
                    className={`grid h-9 w-14 place-items-center rounded-[12px] text-white ${
                      active
                        ? 'bg-brand shadow-[0_0_16px_#ff6b00]'
                        : 'bg-gradient-to-r from-cyan-400 via-white to-brand p-[2px]'
                    }`}
                  >
                    <span
                      className={`grid h-full w-full place-items-center rounded-[10px] ${active ? '' : 'bg-brand'}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  </span>
                  <span className={`mt-0.5 text-[10px] font-bold ${active ? 'text-brand' : 'text-white/60'}`}>
                    {label}
                  </span>
                </Link>
              ) : (
                <Link
                  href={`${base}${href}`}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    key === 'me' && me !== undefined
                      ? me
                        ? t('common.nav.meUser', { name: me.displayName })
                        : t('common.nav.meLogin')
                      : undefined
                  }
                  data-testid={key === 'me' ? 'user-menu' : undefined}
                  className={`relative flex w-14 flex-col items-center gap-0.5 ${
                    active ? 'text-brand' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="text-[10px] font-bold">{label}</span>
                  {key === 'me' && notifications > 0 ? (
                    <span
                      className="absolute -top-1 right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black text-white"
                      data-testid="nav-notifications"
                    >
                      {notifications}
                    </span>
                  ) : null}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
