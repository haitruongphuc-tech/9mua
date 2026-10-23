import Link from 'next/link';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';

const TABS = [
  { href: '/kiot-cua-toi', label: 'Tổng quan' },
  { href: '/kiot-cua-toi/san-pham', label: 'Sản phẩm' },
  { href: '/kiot-cua-toi/don-hang', label: 'Đơn hàng' },
  { href: '/kiot-cua-toi/so-du', label: 'Số dư' },
  { href: '/kiot-cua-toi/thanh-toan', label: 'Thanh toán' },
  { href: '/kiot-cua-toi/cai-dat', label: 'Cài đặt' },
];

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  return (
    <div className="mx-auto w-full max-w-3xl">
      {kiot ? (
        <nav
          aria-label="Quản lý Kiot"
          className="flex gap-1 overflow-x-auto border-b border-black/10 px-4 pt-3"
        >
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="shrink-0 rounded-t-xl px-4 py-2 text-sm font-bold hover:bg-surface-muted"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {children}
    </div>
  );
}
