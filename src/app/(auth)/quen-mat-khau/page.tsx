import type { Metadata } from 'next';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Quên mật khẩu', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">Quên mật khẩu</h1>
      <p className="mb-6 text-black/70">Nhập email của tài khoản, chúng tôi sẽ gửi link đặt mật khẩu mới.</p>
      <ForgotForm />
    </section>
  );
}
