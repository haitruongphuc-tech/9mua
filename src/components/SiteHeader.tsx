import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { kiotSlugFromHost } from '@/lib/host-routing';
import { UserMenu } from './UserMenu';

export async function SiteHeader() {
  // Trên trang Kiot (<slug>.9mua.com) mọi link của thanh trên dẫn về tên miền chính: logo về trang chủ 9MUA
  // (không phải trang Kiot), Chợ/Video… mở thẳng 9mua.com thay vì đi vòng qua chuyển hướng.
  const appUrl = env().APP_URL;
  const kiotSlug = kiotSlugFromHost((await headers()).get('host') ?? '', appUrl);
  const base = kiotSlug ? appUrl : '';
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={`${base}/`} className="flex items-center gap-2" aria-label="9MUA - Trang chủ">
          <Image src="/brand/9mua-icon.png" alt="" width={32} height={32} priority />
          {/* Màn hình rất hẹp (≤ 400px) chỉ hiện biểu tượng để thanh trên không tràn ngang. */}
          <span className="hidden text-xl font-extrabold tracking-tight min-[400px]:inline">9MUA</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-bold sm:gap-2">
          <Link href={`${base}/cho`} className="rounded-full px-2 py-2 hover:bg-surface-muted sm:px-3">
            Chợ
          </Link>
          <Link href={`${base}/video`} className="rounded-full px-2 py-2 hover:bg-surface-muted sm:px-3">
            Video
          </Link>
          <Link
            href={`${base}/kiot-cua-toi`}
            className="hidden rounded-full px-3 py-2 hover:bg-surface-muted sm:inline"
          >
            Bán hàng
          </Link>
          <UserMenu base={base} kiotSlug={kiotSlug} />
        </nav>
      </div>
    </header>
  );
}
