import { ensureAnonId } from '@/lib/anon-id';
import { clientIp } from '@/lib/client-ip';
import { heartbeat } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Tín hiệu "đang xem" mỗi 20 giây khi video đang phát và tab đang mở (đếm người xem thật).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [user, anonId] = await Promise.all([getCurrentUser(), ensureAnonId()]);
  const r = await heartbeat((await params).id, { userId: user?.id, anonId }, clientIp(request));
  return Response.json(r ?? { ended: true }, { headers: { 'cache-control': 'no-store' } });
}
