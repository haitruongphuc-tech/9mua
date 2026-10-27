import { sendHearts } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Tim gom theo lô từ trình duyệt; máy chủ giới hạn 10 tim/giây mỗi người.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'LOGIN' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { count?: unknown };
  const r = await sendHearts((await params).id, user.id, Number(body.count) || 1);
  return Response.json(r ?? { ended: true });
}
