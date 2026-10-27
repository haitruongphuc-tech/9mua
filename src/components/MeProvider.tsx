'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

// Phát sự kiện này sau khi đổi tên/đăng nhập/thêm giỏ để header và thanh dưới cập nhật mà không cần tải lại trang.
export const ME_CHANGED_EVENT = 'nm:me-changed';

export type Me = { displayName: string; role: 'user' | 'admin' } | null;
type MeState = { me: Me | undefined; cartCount: number; notifications: number };

const MeContext = createContext<MeState>({ me: undefined, cartCount: 0, notifications: 0 });

// Một lần gọi /api/auth/me cho cả header và thanh dưới (undefined = đang tải).
export function MeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<MeState>({ me: undefined, cartCount: 0, notifications: 0 });

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/auth/me', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: { user: Me; cartCount?: number; notifications?: number }) => {
          if (alive)
            setState({ me: d.user, cartCount: d.cartCount ?? 0, notifications: d.notifications ?? 0 });
        })
        .catch(() => alive && setState({ me: null, cartCount: 0, notifications: 0 }));
    load();
    window.addEventListener(ME_CHANGED_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(ME_CHANGED_EVENT, load);
    };
  }, [pathname]);

  return <MeContext.Provider value={state}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
