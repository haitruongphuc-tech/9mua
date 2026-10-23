import type { Metadata } from 'next';
import { logoutAction } from '@/app/(auth)/actions';
import { requireUser } from '@/modules/identity';

export const metadata: Metadata = { title: 'Tài khoản', robots: { index: false } };

// Bản tối thiểu cho T5; đổi mật khẩu, thêm email, đăng xuất mọi thiết bị ở task T7.
export default async function AccountPage() {
  const user = await requireUser();
  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold">{user.displayName}</h1>
      <p className="mb-6 text-black/70">{user.phone ?? user.email}</p>
      <form action={logoutAction}>
        <button type="submit" className="h-12 w-full rounded-full border-2 border-brand-ink font-extrabold">
          Đăng xuất
        </button>
      </form>
    </section>
  );
}
