import Image from 'next/image';
import Link from 'next/link';
import { UserMenu } from './UserMenu';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="9MUA - Trang chủ">
          <Image src="/brand/9mua-icon.png" alt="" width={32} height={32} priority />
          <span className="text-xl font-extrabold tracking-tight">9MUA</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-bold">
          <Link href="/cho" className="rounded-full px-3 py-2 hover:bg-surface-muted">
            Chợ
          </Link>
          <Link href="/video" className="rounded-full px-3 py-2 hover:bg-surface-muted">
            Video
          </Link>
          <Link
            href="/kiot-cua-toi"
            className="hidden rounded-full px-3 py-2 hover:bg-surface-muted sm:inline"
          >
            Bán hàng
          </Link>
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
