'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';

// Hỏi trạng thái mỗi 3 giây; khi đã trả (hoặc hết hạn) thì tải lại trang để server hiển thị kết quả.
export function PaymentStatusPoller({ statusUrl, expiresAt }: { statusUrl: string; expiresAt: string }) {
  const t = useT();
  const router = useRouter();
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const tick = setInterval(() => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now())), 1000);
    return () => clearInterval(tick);
  }, [expiresAt]);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(statusUrl, { cache: 'no-store' });
        const data = (await res.json()) as { status?: string };
        if (!stopped && data.status && data.status !== 'pending') {
          stopped = true;
          router.refresh();
        }
      } catch {
        // mạng chập chờn: thử lại ở lượt sau
      }
    };
    const timer = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [statusUrl, router]);

  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return (
    <p className="text-[13px] text-white/70" aria-live="polite" data-testid="payment-countdown">
      {left > 0
        ? t('shop.qr.countdown', { time: `${m}:${String(s).padStart(2, '0')}` })
        : t('shop.qr.expiredCode')}
    </p>
  );
}
