import { getCurrentUser } from '@/modules/identity';
import { readKycImage } from '@/modules/payouts';

export const dynamic = 'force-dynamic';

// Ảnh CCCD: chỉ admin xem được. Người khác nhận 404 như thể không có route này.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; side: string }> }) {
  const user = await getCurrentUser();
  const { id, side } = await params;
  if (user?.role !== 'admin' || (side !== 'front' && side !== 'back'))
    return new Response('Not found', { status: 404 });
  const image = await readKycImage(id, side);
  if (!image) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
