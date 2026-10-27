'use client';

import { Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/client';
import { sloganKey } from '@/lib/slogans';
import { useMe } from './MeProvider';

// Slogan của trang (giữa header, chữ nghiêng xám — V4).
export function HeaderSlogan({ onKiotHost }: { onKiotHost: boolean }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <p className="min-w-0 flex-1 truncate text-[12px] italic text-slogan" data-testid="page-slogan">
      {t(`common.slogan.${sloganKey(pathname, { onKiotHost })}`)}
    </p>
  );
}

// Nút tìm (điện thoại) và giỏ hàng có số món (V4).
export function HeaderActions({ base }: { base: string }) {
  const { cartCount } = useMe();
  const t = useT();
  return (
    <>
      <Link
        href={`${base}/cho`}
        aria-label={t('common.search.button')}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 md:hidden"
      >
        <Search className="h-4 w-4" aria-hidden />
      </Link>
      <Link
        href={`${base}/gio-hang`}
        aria-label={t('common.cart.label', { count: cartCount })}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10"
        data-testid="cart-link"
      >
        <ShoppingBag className="h-4 w-4" aria-hidden />
        {cartCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-black"
            data-testid="cart-count"
          >
            {cartCount}
          </span>
        ) : null}
      </Link>
    </>
  );
}
