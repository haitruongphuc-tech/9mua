import QRCode from 'qrcode';
import { buildVietQr } from '@/modules/payouts';

// QR VietQR để CEO quét bằng app ngân hàng: đã điền sẵn tài khoản, số tiền, nội dung.
export async function VietQrImage(props: {
  bin: string;
  accountNumber: string;
  amount: number;
  description: string;
}) {
  const svg = await QRCode.toString(buildVietQr(props), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  return (
    // SVG do thư viện qrcode tạo từ chuỗi VietQR hệ thống tự dựng, không chứa HTML người dùng nhập.
    <div
      className="h-48 w-48 rounded-xl bg-white p-2"
      role="img"
      aria-label={`QR chuyển ${props.amount} đồng`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
