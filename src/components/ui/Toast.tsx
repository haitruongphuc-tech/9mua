'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Thông báo nhỏ kiểu V4 (viên trắng nổi trên thanh điều hướng). Gọi toast() ở bất kỳ Client Component nào;
// <ToastHost /> nằm trong layout.
const TOAST_EVENT = 'nm:toast';
type ToastDetail = { text: string; action?: { href: string; label: string } };

export function toast(text: string, action?: ToastDetail['action']) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { text, action } }));
}

export function ToastHost() {
  const [item, setItem] = useState<ToastDetail | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      setItem(detail);
      clearTimeout(timer);
      timer = setTimeout(() => setItem(null), detail.action ? 5000 : 2500);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);
  if (!item) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-[90] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-3 text-[12px] font-bold text-black shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      data-testid="toast"
    >
      <span className="min-w-0">{item.text}</span>
      {item.action ? (
        <Link href={item.action.href} className="shrink-0 rounded-full bg-brand px-3 py-1 text-white">
          {item.action.label}
        </Link>
      ) : null}
    </div>
  );
}
