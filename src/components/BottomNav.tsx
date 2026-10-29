'use client';

import { Clapperboard, House, MessageCircle, Radio, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/client';
import { useMe } from './MeProvider';

// Thanh dưới 5 nút, hiện trên mọi màn hình (CEO chốt 29/10/2026, docs/v4-merge-plan.md §7 mục 15):
// Trang chủ · Video · Live (nút giữa) · Kiot (nội dung Chợ, /cho) · Hộp thư. "Tôi" nằm ở ảnh đại diện góc phải header.
// base: '' trên 9mua.com; APP_URL trên trang Kiot (link về tên miền chính, không tô sáng nút nào).
const starts = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
// Trang tài khoản dưới /video (đăng video, video của tôi) không tô sáng nút Video.
const ACCOUNT_VIDEO_PATHS = ['/video/dang', '/video/cua-toi'];

export function BottomNav({ base = '' }: { base?: string }) {
  const pathname = usePathname();
  const { me, inbox, liveNow } = useMe();
  const t = useT();
  const items = [
    { href: '/', key: 'home', label: t('common.nav.home'), Icon: House, active: pathname === '/' },
    {
      href: '/video',
      key: 'video',
      label: t('common.nav.video'),
      Icon: Clapperboard,
      active:
        (starts(pathname, '/video') || starts(pathname, '/v')) &&
        !ACCOUNT_VIDEO_PATHS.some((p) => starts(pathname, p)),
    },
    {
      href: '/live',
      key: 'live',
      label: t('common.nav.live'),
      Icon: Radio,
      center: true,
      active: starts(pathname, '/live'),
    },
    { href: '/cho', key: 'kiot', label: t('common.nav.kiot'), Icon: Store, active: starts(pathname, '/cho') },
    {
      href: me === null ? '/dang-nhap?next=%2Fhop-thu' : '/hop-thu',
      key: 'inbox',
      label: t('common.nav.inbox'),
      Icon: MessageCircle,
      active: starts(pathname, '/hop-thu'),
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
                  className="relative flex flex-col items-center"
                >
                  {liveNow ? (
                    <span
                      className="absolute -right-0.5 -top-0.5 z-10 h-3 w-3 rounded-full border-2 border-ink bg-red-500"
                      data-testid="nav-live-dot"
                    />
                  ) : null}
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
                    key === 'inbox' && inbox > 0 ? t('common.nav.inboxUnread', { count: inbox }) : undefined
                  }
                  data-testid={`nav-${key}`}
                  className={`relative flex w-14 flex-col items-center gap-0.5 ${
                    active ? 'text-brand' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="text-[10px] font-bold">{label}</span>
                  {key === 'inbox' && inbox > 0 ? (
                    <span
                      className="absolute -top-1 right-2 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-black text-white"
                      data-testid="nav-inbox-count"
                      aria-hidden
                    >
                      {inbox > 99 ? '99+' : inbox}
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
