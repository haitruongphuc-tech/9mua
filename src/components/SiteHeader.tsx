import { Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { kiotSlugFromHost } from '@/lib/host-routing';
import { BottomNav } from './BottomNav';
import { UserMenu } from './UserMenu';

export async function SiteHeader() {
  // Trên trang Kiot (<slug>.9mua.com) mọi link của thanh trên dẫn về tên miền chính: logo về trang chủ 9MUA
  // (không phải trang Kiot), Chợ/Video… mở thẳng 9mua.com thay vì đi vòng qua chuyển hướng.
  const appUrl = env().APP_URL;
  const kiotSlug = kiotSlugFromHost((await headers()).get('host') ?? '', appUrl);
  const base = kiotSlug ? appUrl : '';
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href={`${base}/`} className="flex shrink-0 items-center gap-2" aria-label="9MUA - Trang chủ">
            {/* Logo trong vòng tròn trắng viền cam, đứng yên (docs/BRAND.md — CEO chọn 27/10/2026). */}
            <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-brand bg-white shadow-[0_0_0_3px_rgb(252_111_21/0.15)]">
              <Image src="/brand/9mua-icon.png" alt="" width={26} height={26} priority />
            </span>
            <span className="hidden text-xl font-extrabold tracking-tight md:inline">9MUA</span>
          </Link>
          <form action={`${base}/cho`} role="search" className="min-w-0 flex-1 md:max-w-sm">
            <label className="flex h-10 items-center gap-2 rounded-full bg-surface-muted px-3">
              <Search className="h-4 w-4 shrink-0 text-black/50" aria-hidden />
              <input
                type="search"
                name="q"
                enterKeyHint="search"
                placeholder="Tìm trên Chợ…"
                aria-label="Tìm trên Chợ 9MUA"
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-black/50"
              />
            </label>
          </form>
          <nav className="flex shrink-0 items-center gap-1 text-sm font-bold sm:gap-2">
            <Link
              href={`${base}/cho`}
              className="hidden rounded-full px-3 py-2 hover:bg-surface-muted md:inline"
            >
              Chợ
            </Link>
            <Link
              href={`${base}/cho/kiot`}
              className="hidden rounded-full px-3 py-2 hover:bg-surface-muted md:inline"
            >
              Kiot
            </Link>
            <Link
              href={`${base}/kiot-cua-toi`}
              className="hidden rounded-full px-3 py-2 hover:bg-surface-muted md:inline"
            >
              Bán hàng
            </Link>
            <UserMenu base={base} kiotSlug={kiotSlug} />
          </nav>
        </div>
      </header>
      <BottomNav base={base} />
    </>
  );
}
