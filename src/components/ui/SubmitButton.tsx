'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-full border-2 border-brand-ink bg-brand px-6 font-extrabold text-brand-ink disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}
