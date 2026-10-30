import { featureGuard } from '@/lib/features';
import { uploadSessionStatus } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Danh sách phần đã nhận, để trình duyệt gửi tiếp phần còn thiếu sau khi rớt mạng hoặc tải lại trang.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('long_video');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 401 });
  const result = await uploadSessionStatus(user.id, (await params).id);
  return Response.json(result, {
    status: result.ok ? 200 : 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
