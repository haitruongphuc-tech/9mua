'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

// Phát sự kiện này sau khi đổi tên/đăng nhập/thêm giỏ để header và thanh dưới cập nhật mà không cần tải lại trang.
export const ME_CHANGED_EVENT = 'nm:me-changed';

export type Me = { displayName: string; role: 'user' | 'admin' } | null;
type MeState = { me: Me | undefined; cartCount: number; notifications: number; liveNow: boolean };

const MeContext = createContext<MeState>({ me: undefined, cartCount: 0, notifications: 0, liveNow: false });

// Một lần gọi /api/auth/me cho cả header, thanh dưới và popup (undefined = đang tải). hasSession do layout tính từ
// cookie: đổi khi đăng nhập/đăng ký/đăng xuất bằng Server Action (đường dẫn có thể không đổi) để tải lại.
export function MeProvider({ children, hasSession }: { children: React.ReactNode; hasSession: boolean }) {
  const pathname = usePathname();
  const [state, setState] = useState<MeState>({
    me: undefined,
    cartCount: 0,
    notifications: 0,
    liveNow: false,
  });

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/auth/me', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { user: Me; cartCount?: number; notifications?: number; liveNow?: boolean }) => {
          if (alive)
            setState({
              me: d.user,
              cartCount: d.cartCount ?? 0,
              notifications: d.notifications ?? 0,
              liveNow: Boolean(d.liveNow),
            });
        })
        .catch(() => alive && setState({ me: null, cartCount: 0, notifications: 0, liveNow: false }));
    load();
    window.addEventListener(ME_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(ME_CHANGED_EVENT, load);
    };
  }, [pathname, hasSession]);

  return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
