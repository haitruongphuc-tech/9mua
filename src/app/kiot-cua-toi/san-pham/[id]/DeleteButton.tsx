'use client';

import { useT } from '@/i18n/client';

export function DeleteButton({ action }: { action: () => Promise<void> }) {
  const t = useT();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t('seller.pedit.deleteConfirm'))) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="h-12 w-full rounded-full border border-red-500 font-black text-red-400"
      >
        {t('seller.pedit.delete')}
      </button>
    </form>
  );
}
