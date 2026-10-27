import { getIntSetting } from '@/lib/settings';
import { getCurrentUser } from '@/modules/identity';
import { heartKiot } from '@/server/kiot-page';

export const dynamic = 'force-dynamic';

// Thả tim / bỏ tim Kiot (SPEC-social.md mục 6).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { kiotId } = (await request.json().catch(() => ({}))) as { kiotId?: unknown };
  if (typeof kiotId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const result = await heartKiot(user.id, kiotId);
  const limit =
    !result.ok && result.error === 'FREE_LIMIT' ? await getIntSetting('social_free_daily_limit') : undefined;
  return Response.json(
    { ...result, limit },
    { status: !result.ok && result.error === 'NOT_FOUND' ? 404 : 200 },
  );
}
