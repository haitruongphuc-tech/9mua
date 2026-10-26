'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { mainSiteNext } from '@/lib/host-routing';

// Phát sự kiện này sau khi đổi tên/đăng nhập để header cập nhật mà không cần tải lại trang.
export const ME_CHANGED_EVENT = 'nm:me-changed';

type Me = { displayName: string; role: 'user' | 'admin' } | null;

// base: '' trên 9mua.com; APP_URL trên trang Kiot (link phải về tên miền chính). kiotSlug: Kiot đang xem.
export function UserMenu({ base = '', kiotSlug = null }: { base?: string; kiotSlug?: string | null }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [cartCount, setCartCount] = useState(0);
  const [notifications, setNotifications] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/auth/me', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { user: Me; cartCount?: number; notifications?: number }) => {
          if (!alive) return;
          setMe(d.user);
          setCartCount(d.cartCount ?? 0);
          setNotifications(d.notifications ?? 0);
        })
        .catch(() => alive && setMe(null));
    load();
    window.addEventListener(ME_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(ME_CHANGED_EVENT, load);
    };
  }, [pathname]);

  if (me === undefined) return <span className="h-10 w-24" aria-hidden />;
  if (me) {
    return (
      <>
        <Link
          href={`${base}/thong-bao`}
          className="relative rounded-full px-2 py-2"
          aria-label={`Thông báo (${notifications} chưa đọc)`}
          data-testid="notifications-link"
        >
          🔔
          {notifications > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-xs text-white">
              {notifications}
            </span>
          ) : null}
        </Link>
        <Link
          href={`${base}/gio-hang`}
          className="relative rounded-full px-2 py-2"
          aria-label={`Giỏ hàng (${cartCount} món)`}
          data-testid="cart-link"
        >
          🛒
          {cartCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-ink px-1 text-xs text-white"
              data-testid="cart-count"
            >
              {cartCount}
            </span>
          ) : null}
        </Link>
        <Link
          href={`${base}/tai-khoan`}
          className="max-w-24 truncate rounded-full border-2 border-brand-ink px-3 py-2 sm:max-w-36 sm:px-4"
          data-testid="user-menu"
        >
          {me.displayName}
        </Link>
      </>
    );
  }
  const onAuthPage = pathname.startsWith('/dang-nhap') || pathname.startsWith('/dang-ky');
  return (
    <Link
      href={
        onAuthPage
          ? '/dang-nhap'
          : `${base}/dang-nhap?next=${encodeURIComponent(mainSiteNext(pathname, kiotSlug))}`
      }
      className="rounded-full border-2 border-brand-ink bg-brand px-4 py-2 text-brand-ink"
    >
      Đăng nhập
    </Link>
  );
}
