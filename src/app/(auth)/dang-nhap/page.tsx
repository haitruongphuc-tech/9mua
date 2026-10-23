import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { getCurrentUser } from '@/modules/identity';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Đăng nhập', robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; 'da-dat-lai'?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">Đăng nhập 9MUA</h1>
      <p className="mb-6 text-black/70">Một tài khoản dùng cho 9mua.com và mọi Kiot.</p>
      {params['da-dat-lai'] ? (
        <p role="status" className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã đặt mật khẩu mới. Hãy đăng nhập lại.
        </p>
      ) : null}
      <LoginForm next={next} />
    </section>
  );
}
