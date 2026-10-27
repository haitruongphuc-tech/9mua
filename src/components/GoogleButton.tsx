import { getT } from '@/i18n/server';
import { googleMode } from '@/modules/identity';
import { GoogleIcon } from './GoogleIcon';

// Nút "Tiếp tục với Google" (SPEC-identity.md bổ sung 27/10). Ẩn khi chưa cấu hình khoá Google.
export async function GoogleButton({ next, tone = 'dark' }: { next: string; tone?: 'dark' | 'sheet' }) {
  if (googleMode() === 'off') return null;
  const t = await getT();
  return (
    <a
      href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
      className={`flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-bold ${
        tone === 'dark' ? 'bg-white text-black' : 'border border-black/10 text-zinc-900 hover:bg-zinc-50'
      }`}
    >
      <GoogleIcon />
      {t('common.google')}
    </a>
  );
}
