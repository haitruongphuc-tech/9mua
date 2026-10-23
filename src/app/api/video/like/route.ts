import { toggleLike } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { videoId } = (await request.json().catch(() => ({}))) as { videoId?: unknown };
  if (typeof videoId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const result = await toggleLike(videoId, user.id);
  return Response.json(result, { status: result.ok ? 200 : 404 });
}
