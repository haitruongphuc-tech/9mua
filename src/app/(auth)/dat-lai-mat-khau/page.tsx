import type { Metadata } from 'next';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = {
  title: 'Đặt lại mật khẩu',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">Đặt mật khẩu mới</h1>
      <p className="mb-6 text-black/70">Sau khi đổi, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.</p>
      <ResetForm token={token} />
    </section>
  );
}
