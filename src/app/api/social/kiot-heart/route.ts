import { getIntSetting } from '@/lib/settings';
import { getCurrentUser } from '@/modules/identity';
import { toggleKiotHeart } from '@/modules/social';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { kiotId } = (await request.json().catch(() => ({}))) as { kiotId?: unknown };
  if (typeof kiotId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const result = await toggleKiotHeart(user.id, kiotId);
  const limit = !result.ok ? await getIntSetting('social_free_daily_limit') : undefined;
  return Response.json({ ...result, limit });
}
