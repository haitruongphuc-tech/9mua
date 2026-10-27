import QRCode from 'qrcode';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Mã QR (SVG) cho link của chính 9MUA (video, Kiot) trong bảng chia sẻ. Không tạo QR cho link ngoài.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u') ?? '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const root = env().ROOT_DOMAIN;
  const ownHost = target.hostname === root || target.hostname.endsWith(`.${root}`);
  if (!ownHost || !/^https?:$/.test(target.protocol) || raw.length > 500)
    return new Response('Bad request', { status: 400 });
  const svg = await QRCode.toString(target.toString(), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
  });
}
