import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { getTotpStatus } from '@/modules/admin';
import { requireAdmin } from '@/modules/identity';
import { VerifyForm } from './TotpForms';

export const metadata: Metadata = { title: 'Xác thực 2 lớp', robots: { index: false } };

export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const admin = await requireAdmin();
  if ((await getTotpStatus(admin.id)) !== 'enabled') redirect('/admin/xac-thuc/cai-dat');
  const next = safeNextPath((await searchParams).next);
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-extrabold">Nhập mã 2 lớp</h1>
      <p className="text-sm text-white/70">
        Mở Google Authenticator hoặc Authy, nhập mã 6 số của 9MUA Admin.
      </p>
      <VerifyForm next={next} />
    </section>
  );
}
