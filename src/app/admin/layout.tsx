import type { Metadata } from 'next';
import Link from 'next/link';
import { getVerifiedAdmin } from '@/modules/admin';
import { requireAdmin } from '@/modules/identity';

export const metadata: Metadata = {
  title: { default: 'Trang CEO', template: '%s | CEO 9MUA' },
  robots: { index: false },
};
export const dynamic = 'force-dynamic';

const NAV = [
  ['/admin', 'Tổng quan'],
  ['/admin/rut-tien', 'Rút tiền'],
  ['/admin/kyc', 'KYC'],
  ['/admin/hoan-tien', 'Hoàn tiền'],
  ['/admin/khieu-nai', 'Khiếu nại'],
  ['/admin/lech-tien', 'Lệch tiền'],
  ['/admin/bao-cao', 'Báo cáo'],
  ['/admin/tra-cuu', 'Tra cứu'],
  ['/admin/giao-dich', 'Giao dịch'],
  ['/admin/ghim', 'Ghim'],
  ['/admin/noi-dung', 'Slogan & pháp lý'],
  ['/admin/cai-dat', 'Cài đặt'],
] as const;

// Không phải admin → 404 ngay ở layout. Từng trang/Server Action vẫn tự gọi requireAdminVerified() (layout
// không chạy khi gọi Server Action), test tests/admin-routes.test.ts kiểm điều này.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const verified = await getVerifiedAdmin();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      {verified ? (
        <nav
          aria-label="Trang CEO"
          className="sticky top-14 z-30 overflow-x-auto border-b border-white/10 bg-ink px-4"
        >
          <ul className="flex gap-1 py-2 text-sm font-bold">
            {NAV.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block whitespace-nowrap rounded-full px-3 py-1.5 hover:bg-white/5"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
