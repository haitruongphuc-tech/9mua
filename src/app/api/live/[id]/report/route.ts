import { reportLive } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'LOGIN' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown; message?: unknown };
  const r = await reportLive(
    user.id,
    (await params).id,
    String(body.reason ?? ''),
    String(body.message ?? ''),
  );
  return Response.json(r, { status: r.ok || r.error === 'ALREADY' ? 200 : 400 });
}
