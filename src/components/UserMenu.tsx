'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Me = { displayName: string; role: 'user' | 'admin' } | null;

export function UserMenu() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { user: Me }) => alive && setMe(d.user))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (me === undefined) return <span className="h-10 w-24" aria-hidden />;
  if (me) {
    return (
      <Link
        href="/tai-khoan"
        className="max-w-36 truncate rounded-full border-2 border-brand-ink px-4 py-2"
        data-testid="user-menu"
      >
        {me.displayName}
      </Link>
    );
  }
  const onAuthPage = pathname.startsWith('/dang-nhap') || pathname.startsWith('/dang-ky');
  return (
    <Link
      href={onAuthPage ? '/dang-nhap' : `/dang-nhap?next=${encodeURIComponent(pathname)}`}
      className="rounded-full border-2 border-brand-ink bg-brand px-4 py-2 text-brand-ink"
    >
      Đăng nhập
    </Link>
  );
}
