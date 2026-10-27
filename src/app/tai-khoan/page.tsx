import {
  Bell,
  Bookmark,
  ChevronRight,
  Coins,
  Clapperboard,
  Crown,
  Film,
  Gauge,
  LogOut,
  Package,
  Settings,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/(auth)/actions';
import { getT } from '@/i18n/server';
import { requireUser } from '@/modules/identity';
import { loadMePage } from '@/server/me-page';

export const metadata: Metadata = { title: 'Tài khoản', robots: { index: false } };

// Trang Tôi kiểu V4: hồ sơ, Free n/50 hoặc Kiot của bạn, voucher, lối tắt, Bộ sưu tập (SPEC-social.md mục 4, 7, 8).
// Các form đổi tên/email/mật khẩu nằm ở /tai-khoan/cai-dat.
export default async function MePage() {
  const user = await requireUser();
  if (user.mustChangePassword) redirect('/tai-khoan/cai-dat?doi-mat-khau=1');
  const [data, t] = await Promise.all([loadMePage(user), getT()]);
  const { role, follow, free, voucher, kiot, notifications, socialCount, saved, xu } = data;

  const links = [
    {
      href: '/thong-bao',
      label: t('me.link.notifications'),
      sub: t('me.link.notificationsSub', { count: notifications }),
      Icon: Bell,
      aria: t('me.link.notificationsAria', { count: notifications }),
      testId: 'notifications-link',
      badge: notifications,
    },
    { href: '/don-mua', label: t('me.link.orders'), sub: t('me.link.ordersSub'), Icon: Package },
    {
      href: '/tai-khoan/xu',
      label: t('live.xu.title'),
      sub: t('live.xu.unit', { count: xu.toLocaleString(t.lang) }),
      Icon: Coins,
      testId: 'me-xu',
    },
    { href: '/gio-hang', label: t('me.link.cart'), sub: t('me.link.cartSub'), Icon: ShoppingBag },
    { href: '/kiot-cua-toi', label: t('me.link.kiot'), sub: t('me.link.kiotSub'), Icon: Store },
    ...(role === 'free' ? [] : [{ href: '/ai', label: t('ai.link'), sub: t('ai.linkSub'), Icon: Sparkles }]),
    { href: '/video/dang', label: t('me.link.post'), sub: t('me.link.postSub'), Icon: Clapperboard },
    { href: '/video/cua-toi', label: t('me.link.myVideos'), sub: t('me.link.myVideosSub'), Icon: Film },
    {
      href: '/ket-noi',
      label: t('me.link.connect'),
      sub: t('me.link.connectSub', { count: socialCount }),
      Icon: Share2,
    },
    {
      href: '/tai-khoan/cai-dat',
      label: t('me.link.settings'),
      sub: t('me.link.settingsSub'),
      Icon: Settings,
    },
    ...(role === 'admin'
      ? [{ href: '/admin', label: t('me.link.admin'), sub: t('me.link.adminSub'), Icon: Gauge }]
      : []),
  ];
  const tiles = [
    { id: 'following', value: follow.following, label: t('me.stat.following') },
    { id: 'followers', value: follow.followers, label: t('me.stat.followers') },
    { id: 'liked', value: voucher.liked, label: t('me.stat.liked') },
    { id: 'voucher', value: voucher.status === 'usable' ? 1 : 0, label: t('me.stat.voucher') },
  ];

  return (
    <div>
      <div className="mx-auto max-w-[760px] px-4 py-6">
        <div className="text-center">
          <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-brand to-red-500 text-[36px] font-black">
            {user.displayName.trim().charAt(0).toUpperCase()}
          </span>
          <h1 className="mt-3 font-display text-[22px] font-black">{user.displayName}</h1>
          <p className="text-[12px] text-white/50">{user.phone ?? user.email}</p>
          <span
            className={`mt-2 inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12px] font-black ${
              role === 'free' ? 'bg-white/10' : 'bg-brand'
            }`}
            data-testid="me-badge"
          >
            {role === 'free' ? null : <Crown className="h-3.5 w-3.5" aria-hidden />}
            {t(`me.badge.${role}`)}
          </span>
        </div>

        <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
          {tiles.map((x) => (
            <div
              key={x.id}
              className="flex flex-col-reverse rounded-[14px] border border-white/10 bg-white/5 py-3"
            >
              <dt className="text-[10px] text-white/50">{x.label}</dt>
              <dd className="text-[18px] font-black" data-testid={`me-${x.id}`}>
                {x.value.toLocaleString(t.lang)}
              </dd>
            </div>
          ))}
        </dl>

        {free ? (
          <div
            className="mt-4 rounded-[18px] bg-gradient-to-r from-brand to-orange-500 p-4"
            data-testid="me-free"
          >
            <p className="font-black">{t('me.free.title', { used: free.used, limit: free.limit })}</p>
            <p className="text-[12px] opacity-90">{t('me.free.sub')}</p>
            {voucher.enabled && voucher.status === 'none' ? (
              <p className="mt-1 text-[12px] font-bold" data-testid="me-voucher-progress">
                {t('me.free.voucher', { liked: voucher.liked, threshold: voucher.threshold })}
              </p>
            ) : null}
            <Link
              href={kiot ? '/kiot-cua-toi' : '/kiot-cua-toi/tao'}
              className="mt-3 inline-flex h-10 items-center rounded-full bg-white px-5 text-[13px] font-black text-black"
            >
              {t('me.free.open')}
            </Link>
          </div>
        ) : null}

        {voucher.status === 'usable' ? (
          <div
            className="mt-4 flex items-center gap-3 rounded-[18px] border border-brand/40 bg-white/5 p-4"
            data-testid="me-voucher"
          >
            <div className="flex-1">
              <p className="font-black">{t('me.voucher.usable')}</p>
              <p className="text-[12px] text-white/60">{t('me.voucher.usableSub')}</p>
            </div>
            <Link
              href="/kiot-cua-toi"
              className="grid h-9 place-items-center rounded-full bg-brand px-4 text-[12px] font-black"
            >
              {t('me.voucher.use')}
            </Link>
          </div>
        ) : null}

        {kiot ? (
          <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-brand/40 bg-white/5 p-4">
            <Store className="h-8 w-8 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-black">
                {t('me.kiot.title')}{' '}
                <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                  {t(`me.kiot.status.${kiot.status}`)}
                </span>
              </p>
              <p className="truncate text-[12px] text-white/60">
                {t('me.kiot.sub', { name: kiot.name, count: kiot.products })}
              </p>
            </div>
            <Link
              href="/kiot-cua-toi"
              className="grid h-9 shrink-0 place-items-center rounded-full bg-brand px-4 text-[12px] font-black"
            >
              {t('me.kiot.manage')}
            </Link>
          </div>
        ) : null}

        <nav className="mt-4 divide-y divide-white/10 rounded-[18px] border border-white/10 bg-white/5">
          {links.map(({ href, label, sub, Icon, ...x }) => (
            <Link
              key={href}
              href={href}
              aria-label={'aria' in x ? x.aria : undefined}
              data-testid={'testId' in x ? x.testId : undefined}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5"
            >
              <Icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold">{label}</span>
                <span className="block truncate text-[11px] text-white/50">{sub}</span>
              </span>
              {'badge' in x && x.badge ? (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-black">
                  {x.badge}
                </span>
              ) : null}
              <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
            </Link>
          ))}
        </nav>

        {saved.length > 0 ? (
          <section className="mt-4" data-testid="saved-videos">
            <h2 className="flex items-center gap-1 text-[13px] font-black">
              <Bookmark className="h-4 w-4" aria-hidden /> {t('me.saved')}
            </h2>
            <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {saved.map((v) => (
                <li key={v.id} className="shrink-0">
                  <Link
                    href={`/v/${v.id}`}
                    className="relative block h-[150px] w-[100px] overflow-hidden rounded-[14px] bg-white/10"
                  >
                    {v.posterUrl ? (
                      <Image
                        src={v.posterUrl}
                        alt={v.caption || 'Video'}
                        fill
                        sizes="100px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[11px] font-bold">
                      @{v.author.displayName}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center gap-1 rounded-full bg-white/10 text-[13px] font-bold"
          >
            <LogOut className="h-4 w-4" aria-hidden /> {t('me.logout')}
          </button>
        </form>
      </div>
    </div>
  );
}
