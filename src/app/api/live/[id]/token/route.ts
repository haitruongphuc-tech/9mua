import { ensureAnonId } from '@/lib/anon-id';
import { getLiveForViewer } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Mã xem (5 phút) + địa chỉ WHEP cho trình duyệt; gọi lại trước khi hết hạn. Ai cũng xem được, không cần đăng nhập.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, anonId] = await Promise.all([getCurrentUser(), ensureAnonId()]);
  const view = await getLiveForViewer((await params).id, { userId: user?.id, anonId });
  if (!view) return Response.json({ kind: 'missing' }, { status: 404 });
  if (view.kind !== 'live') return Response.json({ kind: view.kind });
  return Response.json(
    { kind: 'live', status: view.status, whepUrl: view.whepUrl, viewToken: view.viewToken },
    { headers: { 'cache-control': 'no-store' } },
  );
}
