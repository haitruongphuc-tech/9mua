import QRCode from 'qrcode';
import { kiotOrigin } from '@/lib/urls';
import { getCurrentUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';

export const dynamic = 'force-dynamic';

// Ảnh PNG mã QR dẫn tới trang Kiot (QR đường link, KHÔNG phải QR chuyển khoản) để in dán tại quầy.
export async function GET() {
  const user = await getCurrentUser();
  const kiot = user ? await getKiotByOwner(user.id) : null;
  if (!kiot) return new Response('Not found', { status: 404 });
  const png = await QRCode.toBuffer(kiotOrigin(kiot.slug), {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${kiot.slug}.png"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
