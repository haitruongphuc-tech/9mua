import { getCurrentUser } from '@/modules/identity';
import { toggleSave } from '@/modules/social';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { videoId } = (await request.json().catch(() => ({}))) as { videoId?: unknown };
  if (typeof videoId !== 'string') return Response.json({ ok: false }, { status: 400 });
  return Response.json(await toggleSave(user.id, videoId));
}
