import type { Metadata } from 'next';
import { requireAdmin } from '@/modules/identity';

export const metadata: Metadata = { title: 'Quản trị', robots: { index: false } };

// Trang CEO tạm thời — giao diện đầy đủ và xác thực 2 lớp làm ở task T31.
export default async function AdminHome() {
  const admin = await requireAdmin();
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-extrabold">Trang CEO</h1>
      <p className="text-black/70">Xin chào {admin.displayName}. Trang quản trị đang được xây dựng.</p>
    </section>
  );
}
