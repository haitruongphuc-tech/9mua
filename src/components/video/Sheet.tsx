'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n/client';

// Bảng trượt từ dưới lên kiểu V4 (nền trắng, bo trên 24px). Gắn vào <body> để nổi trên thanh điều hướng.
export function Sheet({
  open,
  onClose,
  title,
  children,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="max-h-[88dvh] w-full animate-[sheetUp_0.25s_ease] overflow-y-auto rounded-t-[24px] bg-white p-5 text-zinc-900 md:max-w-[440px] md:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 md:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-[16px] font-bold leading-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 hover:bg-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
