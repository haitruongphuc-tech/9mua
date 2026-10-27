import { ensureAnonId } from '@/lib/anon-id';
import { reportConnect } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Trình duyệt báo có kết nối được hình hay không (1 lần mỗi lượt xem) để CEO biết khi nào cần TURN.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => null)) as { ok?: unknown } | null;
  if (typeof body?.ok !== 'boolean') return Response.json({ ok: false }, { status: 400 });
  const [user, anonId] = await Promise.all([getCurrentUser(), ensureAnonId()]);
  await reportConnect((await params).id, { userId: user?.id, anonId }, body.ok);
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
