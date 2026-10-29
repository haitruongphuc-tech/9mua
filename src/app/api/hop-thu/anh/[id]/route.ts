import { getVerifiedAdmin } from '@/modules/admin';
import { getCurrentUser } from '@/modules/identity';
import { readMessageImage } from '@/modules/messages';

export const dynamic = 'force-dynamic';

// Ảnh trong tin nhắn: chỉ người gửi, 2 thành viên cuộc trò chuyện, hoặc CEO đã qua 2 lớp khi cuộc đó bị báo cáo.
// Người khác nhận 404 như thể không có ảnh.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const admin = user.role === 'admin' && Boolean(await getVerifiedAdmin());
  const data = await readMessageImage(user.id, (await params).id, { admin });
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
