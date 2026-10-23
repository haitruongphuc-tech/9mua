import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/modules/identity';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Đăng ký', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Đã đăng nhập (vd. bấm "Tạo Kiot" ở trang chủ) thì đi thẳng tới trang cần tới.
  if (await getCurrentUser()) redirect(safeNextPath(next));
  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">Tạo tài khoản 9MUA</h1>
      <p className="mb-6 text-black/70">Mua hàng, mở Kiot và đăng video chỉ với một tài khoản.</p>
      <RegisterForm next={safeNextPath(next)} />
    </section>
  );
}
