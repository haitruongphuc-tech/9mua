import type { Metadata } from 'next';
import Link from 'next/link';
import QRCode from 'qrcode';
import { now } from '@/lib/clock';
import { env } from '@/lib/env';
import { kiotOrigin } from '@/lib/urls';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, kiotStatus } from '@/modules/kiot';
import { getKiotFee } from '@/modules/billing';
import { formatDateVN, formatVnd } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { startKiotPaymentAction } from './thanh-toan/actions';

export const metadata: Metadata = { title: 'Kiot của tôi', robots: { index: false } };

export default async function SellerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ 'moi-tao'?: string; 'loi-thanh-toan'?: string }>;
}) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-12 text-center">
        <h1 className="text-2xl font-extrabold">Bạn chưa có Kiot</h1>
        <p className="max-w-sm text-black/70">
          Mở Kiot tại tenkiot.9mua.com, đăng sản phẩm và bán trên Chợ 9MUA.
        </p>
        <Link
          href="/kiot-cua-toi/tao"
          className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
        >
          Tạo Kiot ngay
        </Link>
      </section>
    );
  }

  const status = kiotStatus(kiot);
  const url = kiotOrigin(kiot.slug);
  const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  const params = await searchParams;
  const justCreated = Boolean(params['moi-tao']);
  const fee = await getKiotFee();
  return (
    <section className="flex flex-col gap-5 px-4 py-6">
      {justCreated ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã tạo Kiot! Hãy đăng sản phẩm rồi kích hoạt để Kiot hiện công khai.
        </p>
      ) : null}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold">{kiot.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm text-black/70" data-testid="kiot-url">
            {kiot.slug}.{env().ROOT_DOMAIN}
          </span>
        </div>
        {kiot.activeUntil && status !== 'locked' ? (
          <p className="text-sm text-black/70">
            {status === 'active' ? 'Hoạt động đến' : 'Đã hết hạn ngày'} {formatDateVN(kiot.activeUntil)}
          </p>
        ) : null}
        {status === 'locked' ? (
          <p className="text-sm text-danger">
            Kiot bị khoá{kiot.lockReason ? `: ${kiot.lockReason}` : ''}. Liên hệ 9MUA.
          </p>
        ) : null}
      </header>
      {status === 'active' &&
      kiot.activeUntil &&
      kiot.activeUntil.getTime() - now().getTime() <= 14 * 86_400_000 ? (
        <p
          role="alert"
          data-testid="expiry-banner"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          Kiot sắp hết hạn ngày {formatDateVN(kiot.activeUntil)}. Gia hạn ngay để không bị gián đoạn bán hàng.
        </p>
      ) : null}
      {status !== 'locked' ? (
        <form
          action={startKiotPaymentAction}
          className="flex flex-col gap-2 rounded-2xl border-2 border-brand-ink bg-brand/10 p-4"
        >
          <p className="text-sm">
            {status === 'draft'
              ? 'Kích hoạt để Kiot hiện công khai trên tenkiot.9mua.com và Chợ.'
              : status === 'expired'
                ? 'Kiot đang tạm ngưng. Gia hạn để mở lại ngay, sản phẩm vẫn còn nguyên.'
                : 'Gia hạn sớm được cộng dồn, không mất ngày nào.'}
          </p>
          <button
            type="submit"
            data-testid="activate-kiot"
            className="rounded-full border-2 border-brand-ink bg-brand py-3 font-extrabold text-brand-ink"
          >
            {status === 'draft'
              ? `Kích hoạt Kiot – ${formatVnd(fee)}/năm`
              : `Gia hạn thêm 1 năm – ${formatVnd(fee)}`}
          </button>
          {params['loi-thanh-toan'] ? (
            <p className="text-sm text-danger">Không tạo được thanh toán. Vui lòng thử lại.</p>
          ) : null}
        </form>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/kiot-cua-toi/san-pham"
          className="rounded-2xl border-2 border-black/10 p-4 font-bold hover:border-brand-ink"
        >
          Quản lý sản phẩm →
        </Link>
        <a href={url} className="rounded-2xl border-2 border-black/10 p-4 font-bold hover:border-brand-ink">
          Xem trang Kiot →
        </a>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border-2 border-black/10 p-4">
        {/* SVG do thư viện qrcode tạo từ URL của chính Kiot, không chứa dữ liệu người dùng nhập. */}
        <div
          className="h-28 w-28 shrink-0"
          aria-label={`Mã QR tới ${url}`}
          role="img"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-2">
          <p className="font-bold">QR trang Kiot</p>
          <p className="text-sm text-black/70">In dán tại quầy để khách quét vào xem sản phẩm.</p>
          <a
            href="/api/kiot/qr"
            className="self-start rounded-full border-2 border-brand-ink px-4 py-1.5 text-sm font-bold"
            download
          >
            Tải QR (PNG)
          </a>
        </div>
      </div>
    </section>
  );
}
