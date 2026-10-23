import { requireAdminVerified } from '@/modules/admin';

// Tổng quan + hộp "Cần xử lý" làm ở T32.
export default async function AdminHome() {
  const admin = await requireAdminVerified();
  return (
    <section className="px-4 py-6">
      <h1 className="text-2xl font-extrabold">Trang CEO</h1>
      <p className="text-black/70" data-testid="admin-home">
        Xin chào {admin.displayName}.
      </p>
    </section>
  );
}
