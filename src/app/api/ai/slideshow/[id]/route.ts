import { slideshowStatus } from '@/modules/ai';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// AI Studio hỏi mỗi 2 giây video ghép xong chưa (worker ghép). Chỉ chủ của video xem được.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const status = await slideshowStatus(user.id, (await params).id);
  if (!status) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  return Response.json(status, { headers: { 'cache-control': 'no-store' } });
}
