'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';
import { SocialButtons, type SocialModes } from '@/components/auth/SocialButtons';
import { useT } from '@/i18n/client';
import { LogoV4 } from './LogoV4';
import { useMe } from './MeProvider';

// Popup mở tài khoản kiểu V4 (SPEC-identity.md bổ sung 27/10): khách chưa đăng nhập, sau 1,2 giây, bảng trượt từ
// dưới lên. "Để sau" hoặc ✕ thì 30 ngày không hiện lại (cookie dùng chung cho trang Kiot).
export const SIGNUP_LATER_COOKIE = 'nm_signup_later';
// Mở popup ngay (vd. bấm chat/tim trên live khi chưa đăng nhập) mà không rời trang đang xem.
export const OPEN_SIGNUP_EVENT = 'nm:open-signup';
const HIDDEN_ON = [
  '/dang-nhap',
  '/dang-ky',
  '/quen-mat-khau',
  '/dat-lai-mat-khau',
  '/admin',
  '/dat-hang',
  '/gio-hang',
];

export function SignupPopup({
  cookieDomain,
  freeLimit,
  voucherThreshold,
  modes,
}: {
  cookieDomain: string | null;
  freeLimit: number;
  voucherThreshold: number;
  modes: SocialModes;
}) {
  const t = useT();
  const { me } = useMe();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);

  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  useEffect(() => {
    if (me !== null || hiddenHere || document.cookie.includes(`${SIGNUP_LATER_COOKIE}=1`)) return;
    const timer = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(timer);
  }, [me, hiddenHere]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_SIGNUP_EVENT, show);
    return () => window.removeEventListener(OPEN_SIGNUP_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && later();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function later() {
    const domain = cookieDomain ? `; domain=${cookieDomain}` : '';
    document.cookie = `${SIGNUP_LATER_COOKIE}=1; path=/; max-age=${30 * 86400}; samesite=lax${domain}`;
    setOpen(false);
  }

  if (!open || me) return null;
  const next = `${pathname}${search.size ? `?${search}` : ''}`;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={later}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-popup-title"
        className="max-h-[88dvh] w-full animate-[sheetUp_0.25s_ease] overflow-y-auto rounded-t-[24px] bg-white p-5 text-zinc-900 md:max-w-[440px] md:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
        data-testid="signup-popup"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 md:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="signup-popup-title" className="font-display text-[16px] font-bold leading-tight">
            {t('common.popup.title')}
          </h3>
          <button
            type="button"
            onClick={later}
            aria-label={t('common.close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 hover:bg-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mb-4 flex justify-center">
          <LogoV4 size={64} />
        </div>
        <SocialButtons
          modes={modes}
          next={next}
          tone="sheet"
          labels={{ zalo: t('auth.zalo'), google: t('common.google'), facebook: t('auth.facebook') }}
        />
        {modes.zalo || modes.google || modes.facebook ? (
          <div className="my-4 flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            {t('auth.or')}
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        ) : null}
        <EmailOtpForm next={next} tone="sheet" />
        <ul className="mt-4 space-y-1 text-[11px] text-zinc-500">
          <li>• {t('common.popup.perk1')}</li>
          <li>• {t('common.popup.perk2', { limit: freeLimit, threshold: voucherThreshold })}</li>
        </ul>
        <Link
          href={`/dang-nhap?next=${encodeURIComponent(next)}`}
          className="mt-3 block text-center text-[13px] font-bold text-brand"
        >
          {t('common.popup.login')}
        </Link>
        <button type="button" onClick={later} className="mt-2 w-full text-[12px] text-zinc-500 underline">
          {t('common.popup.later')}
        </button>
      </div>
    </div>
  );
}
