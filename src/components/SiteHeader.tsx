import { Search } from 'lucide-react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { kiotSlugFromHost } from '@/lib/host-routing';
import { BottomNav } from './BottomNav';
import { HeaderActions, HeaderSlogan } from './HeaderActions';
import { LanguageMenu } from './LanguageMenu';
import { LogoV4 } from './LogoV4';

// Header + thanh dưới theo chuẩn V4 (docs/BRAND.md, CEO chốt 27/10/2026).
export async function SiteHeader() {
  // Trên trang Kiot (<slug>.9mua.com) mọi link của header và thanh dưới dẫn về tên miền chính: logo về trang chủ
  // 9MUA (không phải trang Kiot), Chợ/Live… mở thẳng 9mua.com thay vì đi vòng qua chuyển hướng.
  const appUrl = env().APP_URL;
  const kiotSlug = kiotSlugFromHost((await headers()).get('host') ?? '', appUrl);
  const base = kiotSlug ? appUrl : '';
  const t = await getT();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-3 md:px-6">
          <Link
            href={`${base}/`}
            aria-label={t('common.home')}
            className="shrink-0 rounded-full"
            style={{ animation: 'glowPulse 2.8s infinite' }}
          >
            <LogoV4 />
          </Link>
          <HeaderSlogan onKiotHost={Boolean(kiotSlug)} />
          <form
            action={`${base}/cho`}
            role="search"
            className="hidden h-10 w-[300px] items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 md:flex"
          >
            <Search className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
            <input
              type="search"
              name="q"
              enterKeyHint="search"
              placeholder={t('common.search.placeholder')}
              aria-label={t('common.search.label')}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/40"
            />
          </form>
          <LanguageMenu onKiotHost={Boolean(kiotSlug)} />
          <HeaderActions base={base} />
        </div>
      </header>
      <BottomNav base={base} />
    </>
  );
}
