import QRCode from 'qrcode';
import { formatVnd } from '@/lib/format';
import type { PaymentIntentView } from '@/server/payments';
import { PaymentStatusPoller } from './PaymentStatusPoller';

// Khối thanh toán dùng chung (phí thuê Kiot, đơn hàng): QR to, số tiền, nội dung, đếm ngược, tự kiểm tra.
export async function PaymentQr({ intent, statusUrl }: { intent: PaymentIntentView; statusUrl: string }) {
  const svg = await QRCode.toString(intent.qrCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-brand-ink p-5 text-center">
      <p className="text-sm font-bold text-black/70">Quét mã bằng app ngân hàng bất kỳ</p>
      {/* SVG do thư viện qrcode tạo từ chuỗi PayOS trả về, không chứa dữ liệu người dùng nhập. */}
      <div
        className="aspect-square w-full max-w-72 rounded-2xl bg-white p-2"
        role="img"
        aria-label="Mã QR thanh toán"
        data-testid="payment-qr"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <dl className="grid w-full grid-cols-2 gap-2 text-left text-sm">
        <dt className="text-black/60">Số tiền</dt>
        <dd className="text-right text-lg font-extrabold" data-testid="payment-amount">
          {formatVnd(intent.amount)}
        </dd>
        <dt className="text-black/60">Nội dung</dt>
        <dd className="text-right font-bold">{intent.description}</dd>
        <dt className="text-black/60">Người nhận</dt>
        <dd className="text-right font-bold">9MUA CO.,LTD</dd>
      </dl>
      <a
        href={intent.checkoutUrl}
        className="w-full rounded-full border-2 border-brand-ink bg-brand py-3 font-extrabold text-brand-ink"
      >
        Mở trang thanh toán / app ngân hàng
      </a>
      <PaymentStatusPoller statusUrl={statusUrl} expiresAt={intent.expiresAt.toISOString()} />
    </div>
  );
}
