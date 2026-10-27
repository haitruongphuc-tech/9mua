import QRCode from 'qrcode';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import type { PaymentIntentView } from '@/server/payments';
import { PaymentStatusPoller } from './PaymentStatusPoller';

// Khối thanh toán dùng chung (phí thuê Kiot, đơn hàng): QR to, số tiền, nội dung, đếm ngược, tự kiểm tra.
export async function PaymentQr({ intent, statusUrl }: { intent: PaymentIntentView; statusUrl: string }) {
  const [svg, t] = await Promise.all([
    QRCode.toString(intent.qrCode, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    getT(),
  ]);
  return (
    <div className="flex flex-col items-center gap-4 rounded-[18px] border border-white/10 bg-white/5 p-5 text-center">
      <p className="text-[13px] font-bold text-white/70">{t('shop.qr.scan')}</p>
      {/* SVG do thư viện qrcode tạo từ chuỗi PayOS trả về, không chứa dữ liệu người dùng nhập. */}
      <div
        className="aspect-square w-full max-w-72 rounded-[16px] bg-white p-2"
        role="img"
        aria-label={t('shop.qr.alt')}
        data-testid="payment-qr"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <dl className="grid w-full grid-cols-2 gap-2 text-left text-[13px]">
        <dt className="text-white/50">{t('shop.qr.amount')}</dt>
        <dd className="text-right text-lg font-black text-brand" data-testid="payment-amount">
          {formatVnd(intent.amount)}
        </dd>
        <dt className="text-white/50">{t('shop.qr.content')}</dt>
        <dd className="text-right font-bold">{intent.description}</dd>
        <dt className="text-white/50">{t('shop.qr.receiver')}</dt>
        <dd className="text-right font-bold">9MUA CO.,LTD</dd>
      </dl>
      <a
        href={intent.checkoutUrl}
        className="flex h-12 w-full items-center justify-center rounded-full bg-brand font-black text-white"
      >
        {t('shop.qr.open')}
      </a>
      <ClientMessages prefixes={['shop.qr.']}>
        <PaymentStatusPoller statusUrl={statusUrl} expiresAt={intent.expiresAt.toISOString()} />
      </ClientMessages>
    </div>
  );
}
