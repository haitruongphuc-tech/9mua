import type { Metadata } from 'next';
import { logoutAction, logoutOtherDevicesAction } from '@/app/(auth)/actions';
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
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-2xl font-extrabold">{user.displayName}</h1>
        <p className="text-black/70">{user.phone ?? user.email}</p>
      </header>

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
