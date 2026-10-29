'use client';

import { useFormStatus } from 'react-dom';

// tone 'v4' (mặc định): nút V4 cam đặc chữ trắng rất đậm (docs/BRAND.md); 'light': nút cũ chữ đen trên cam.
export function SubmitButton({
  children,
  pendingText,
  tone = 'v4',
  testId,
}: {
  children: React.ReactNode;
  pendingText: string;
  tone?: 'light' | 'v4';
  testId?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={testId}
      disabled={pending}
      className={
        tone === 'v4'
          ? 'h-12 rounded-full bg-brand px-6 font-black text-white shadow-[0_0_20px_rgb(255_107_0/0.35)] disabled:opacity-60'
          : 'h-12 rounded-full border-2 border-brand-ink bg-brand px-6 font-extrabold text-brand-ink disabled:opacity-60'
      }
    >
      {pending ? pendingText : children}
    </button>
  );
}
