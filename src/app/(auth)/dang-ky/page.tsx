import type { Metadata } from 'next';
import { safeNextPath } from '@/lib/safe-next-path';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Đăng ký', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">Tạo tài khoản 9MUA</h1>
      <p className="mb-6 text-black/70">Mua hàng, mở Kiot và đăng video chỉ với một tài khoản.</p>
      <RegisterForm next={safeNextPath(next)} />
    </section>
  );
}
