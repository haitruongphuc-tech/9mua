import type { Metadata } from 'next';
import Link from 'next/link';
import { logoutAction, logoutOtherDevicesAction } from '@/app/(auth)/actions';
import { unreadCount } from '@/lib/notifications';
import { requireUser } from '@/modules/identity';
import { EmailForm, PasswordForm, ProfileForm } from './AccountForms';

export const metadata: Metadata = { title: 'Tài khoản', robots: { index: false } };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-dang-xuat-thiet-bi-khac'?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const notifications = await unreadCount(user.id);
  // Trang Tôi là lối vào mọi thứ của tài khoản (thanh dưới V4 không còn chuông thông báo hay nút Đăng video).
  const shortcuts = [
    { href: '/don-mua', label: '📦 Đơn mua' },
    { href: '/gio-hang', label: '🛒 Giỏ hàng' },
    { href: '/kiot-cua-toi', label: '🏪 Kiot của tôi' },
    { href: '/video/dang', label: '🎬 Đăng video' },
    { href: '/video/cua-toi', label: '📊 Video của tôi' },
  ];
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-2xl font-extrabold">{user.displayName}</h1>
        <p className="text-black/70">{user.phone ?? user.email}</p>
      </header>

      <nav className="grid grid-cols-2 gap-2 text-center font-bold">
        <Link
          href="/thong-bao"
          className="rounded-2xl border-2 border-black/10 p-3 hover:border-brand-ink"
          aria-label={`Thông báo (${notifications} chưa đọc)`}
          data-testid="notifications-link"
        >
          🔔 Thông báo{notifications > 0 ? ` (${notifications})` : ''}
        </Link>
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border-2 border-black/10 p-3 hover:border-brand-ink"
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {user.mustChangePassword ? <PasswordForm forced /> : null}
      <ProfileForm displayName={user.displayName} />
      <EmailForm email={user.email} />
      {user.mustChangePassword ? null : <PasswordForm forced={false} />}

      <section className="flex flex-col gap-3 rounded-2xl border-2 border-black/10 p-5">
        <h2 className="text-lg font-extrabold">Thiết bị</h2>
        {params['da-dang-xuat-thiet-bi-khac'] ? (
          <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
            Đã đăng xuất khỏi mọi thiết bị khác.
          </p>
        ) : null}
        <form action={logoutOtherDevicesAction}>
          <button type="submit" className="h-12 w-full rounded-full border-2 border-brand-ink font-extrabold">
            Đăng xuất khỏi mọi thiết bị khác
          </button>
        </form>
        <form action={logoutAction}>
          <button
            type="submit"
            className="h-12 w-full rounded-full border-2 border-danger font-extrabold text-danger"
          >
            Đăng xuất
          </button>
        </form>
      </section>
    </div>
  );
}
