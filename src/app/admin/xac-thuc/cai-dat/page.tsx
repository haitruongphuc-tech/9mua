import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { beginTotpSetup, getTotpStatus } from '@/modules/admin';
import { requireAdmin } from '@/modules/identity';
import { ConfirmSetupForm } from '../TotpForms';

export const metadata: Metadata = { title: 'Cài xác thực 2 lớp', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Lần đầu vào trang CEO: bắt buộc cài 2 lớp (SPEC-admin.md mục 1). Mỗi lần mở trang tạo bí mật mới cho tới
// khi xác nhận xong, nên QR cũ bị lộ cũng vô dụng.
export default async function AdminTotpSetupPage() {
  const admin = await requireAdmin();
  if ((await getTotpStatus(admin.id)) === 'enabled') redirect('/admin');
  const setup = await beginTotpSetup(admin.id, admin.phone ?? admin.email ?? admin.displayName);
  if (!setup) redirect('/admin');
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-extrabold">Cài xác thực 2 lớp</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-black/70">
        <li>Cài Google Authenticator hoặc Authy trên điện thoại.</li>
        <li>Quét mã QR dưới đây (hoặc nhập khoá thủ công).</li>
        <li>Nhập mã 6 số ứng dụng hiện ra.</li>
      </ol>
      {/* SVG do thư viện qrcode tạo từ URI otpauth của chính hệ thống. */}
      <div
        className="mx-auto h-56 w-56"
        role="img"
        aria-label="Mã QR cài xác thực 2 lớp"
        dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
      />
      <p
        className="break-all rounded-xl bg-surface-muted p-3 text-center font-mono text-sm"
        data-testid="totp-secret"
      >
        {setup.secret}
      </p>
      <ConfirmSetupForm />
    </section>
  );
}
