import {
  Bell,
  Bookmark,
  ChevronRight,
  Clapperboard,
  UsersRound,
  Coins,
  Crown,
  Film,
  Gauge,
  History,
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
import { isTemporaryName, MAX_ACCOUNTS, requireUser, savedAccounts } from '@/modules/identity';
import { AccountSwitcher } from '@/components/auth/AccountSwitcher';
import { loadMePage } from '@/server/me-page';
import { followSuggestions, memoriesOf, pointBalance } from '@/modules/social';
import { exchangePointsAction } from './points-actions';
import { isFeatureOn } from '@/lib/features';
import { ClientMessages } from '@/i18n/ClientMessages';
import { SuggestRow } from '@/components/profile/SuggestRow';
import { Avatar } from '@/components/ui/Avatar';

export const metadata: Metadata = { title: 'Tài khoản', robots: { index: false } };

// Trang Tôi kiểu V4: hồ sơ, Free n/50 hoặc Kiot của bạn, voucher, lối tắt, Bộ sưu tập (SPEC-social.md mục 4, 7, 8).
// Các form đổi tên/email/mật khẩu nằm ở /tai-khoan/cai-dat.
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ 'doi-diem'?: string; 'loi-doi-diem'?: string; 'loi-tai-khoan'?: string }>;
}) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect('/tai-khoan/cai-dat?doi-mat-khau=1');
  const [data, t] = await Promise.all([loadMePage(user), getT()]);
  // Gợi ý follow (SPEC-social.md V5.1 mục 2), công tắc social_more.
  const suggestions = (await isFeatureOn('social_more')) ? await followSuggestions(user.id) : [];
  // Điểm thưởng (SPEC-social.md V5.6): tổng điểm; đổi điểm ra xu khi công tắc points_exchange bật.
  const [pointsOn, exchangeOn] = await Promise.all([isFeatureOn('points'), isFeatureOn('points_exchange')]);
  const points = pointsOn ? await pointBalance(user.id) : 0;
  const query = await searchParams;
  // Kỷ niệm "Ngày này năm trước" (SPEC-social.md V5.7 mục 2), công tắc events.
  const memories = (await isFeatureOn('events')) ? await memoriesOf(user.id) : null;
  const { role, follow, free, voucher, kiot, notifications, socialCount, saved, xu } = data;

  const groupsOn = await isFeatureOn('groups');
  // Nhiều tài khoản trên một máy (SPEC-identity.md V5.5), công tắc account_more. Admin không dùng.
  const accountsOn = user.role !== 'admin' && (await isFeatureOn('account_more'));
  const otherAccounts = accountsOn ? await savedAccounts(user.id) : [];
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
    // Nhóm cộng đồng (SPEC-social.md V5.10), công tắc groups.
    ...(groupsOn
      ? [
          {
            href: '/nhom',
            label: t('feed.group.title'),
            sub: t('feed.group.mine'),
            Icon: UsersRound,
            testId: 'me-groups',
          },
        ]
      : []),
    {
      href: '/tai-khoan/lich-su-xem',
      label: t('me.link.history'),
      sub: t('me.link.historySub'),
      Icon: History,
    },
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
          <Link
            href={`/creator/${user.id}`}
            className="mx-auto inline-block"
            aria-label={t('me.viewProfile')}
          >
            <Avatar name={user.displayName} url={user.avatarUrl} className="h-24 w-24 text-[36px]" />
          </Link>
          <h1 className="mt-3 font-display text-[22px] font-black">{user.displayName}</h1>
          <p className="text-[12px] text-white/50">{user.phone ?? user.email}</p>
          {/* Trang cá nhân công khai + Sửa hồ sơ (SPEC-social.md bổ sung 30/10, A2). */}
          <div className="mt-3 flex justify-center gap-2 text-[13px] font-bold">
            <Link
              href={`/creator/${user.id}`}
              className="h-9 rounded-full border border-white/20 px-4 leading-9"
              data-testid="me-view-profile"
            >
              {t('me.viewProfile')}
            </Link>
            <Link
              href="/tai-khoan/ho-so"
              className="h-9 rounded-full bg-white/10 px-4 leading-9"
              data-testid="me-edit-profile"
            >
              {t('profile.edit.button')}
            </Link>
          </div>
          {isTemporaryName(user.displayName) ? (
            // Đăng ký chỉ bằng email nên đang dùng tên tạm (CEO chốt 29/10): nhắc đặt tên trong trang Sửa hồ sơ.
            <Link
              href="/tai-khoan/ho-so#thong-tin"
              className="mx-auto mt-3 flex max-w-sm items-center justify-between gap-3 rounded-[14px] border border-brand/40 bg-brand/10 px-4 py-3 text-left text-[13px]"
              data-testid="me-set-name"
            >
              <span>{t('me.setName')}</span>
              <span className="shrink-0 font-black text-brand">{t('me.setNameCta')} →</span>
            </Link>
          ) : null}
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

        {memories && (memories.videos.length || memories.posts.length) ? (
          <section
            className="mt-6 flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
            data-testid="me-memories"
          >
            <h2 className="text-[13px] font-black">🕰 {t('me.memories.title')}</h2>
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {memories.videos.map((v) => (
                <li key={v.id} className="w-24 shrink-0">
                  <Link
                    href={`/v/${v.id}`}
                    className="relative block aspect-[9/16] overflow-hidden rounded-[10px] bg-black"
                  >
                    {v.posterUrl ? (
                      <Image
                        src={v.posterUrl}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </Link>
                </li>
              ))}
              {memories.posts.map((p) => (
                <li key={p.id} className="w-40 shrink-0">
                  <Link
                    href={`/p/${p.id}`}
                    className="line-clamp-4 block rounded-[10px] bg-white/10 p-2 text-[12px]"
                  >
                    {p.text || '🖼'}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-white/50">{t('me.memories.hint')}</p>
          </section>
        ) : null}
        {accountsOn ? (
          <>
            {query['loi-tai-khoan'] === 'FULL' || query['loi-tai-khoan'] === 'ADMIN' ? (
              <p role="alert" className="mt-6 text-[12px] font-bold text-red-300">
                {t(`me.accounts.err.${query['loi-tai-khoan']}`)}
              </p>
            ) : null}
            <AccountSwitcher
              accounts={otherAccounts}
              canAdd={otherAccounts.length + 1 < MAX_ACCOUNTS}
              labels={{
                title: t('me.accounts.title'),
                switchTo: t('me.accounts.switchTo'),
                add: t('me.accounts.add'),
                logoutAll: t('me.accounts.logoutAll'),
              }}
            />
          </>
        ) : null}
        {pointsOn ? (
          <section
            className="mt-6 flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
            data-testid="me-points"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-white/70">⭐ {t('me.points.title')}</span>
              <span className="text-[18px] font-black" data-testid="me-points-balance">
                {t('me.points.balance', { points: points.toLocaleString(t.lang) })}
              </span>
            </div>
            <p className="text-[11px] text-white/50">{t('me.points.hint')}</p>
            {query['doi-diem'] ? (
              <p role="status" className="text-[12px] font-bold text-green-300">
                {t('me.points.done', { xu: query['doi-diem'] })}
              </p>
            ) : null}
            {query['loi-doi-diem'] ? (
              <p role="alert" className="text-[12px] font-bold text-red-300">
                {t(
                  `me.points.err.${['TOO_FEW', 'ONCE_A_DAY', 'MONTH_CAP', 'BUDGET', 'NOT_ALLOWED'].includes(query['loi-doi-diem']) ? query['loi-doi-diem'] : 'OFF'}` as 'me.points.err.OFF',
                )}
              </p>
            ) : null}
            {exchangeOn ? (
              <form action={exchangePointsAction}>
                <button
                  type="submit"
                  className="h-10 w-full rounded-full bg-brand text-[13px] font-black text-white"
                  data-testid="me-points-exchange"
                >
                  {t('me.points.exchange')}
                </button>
              </form>
            ) : null}
          </section>
        ) : null}
        {suggestions.length ? (
          <div className="mt-6">
            <ClientMessages prefixes={['profile.suggest.']}>
              <SuggestRow people={suggestions} />
            </ClientMessages>
          </div>
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
