import { getIntSetting } from '@/lib/settings';
import { getCurrentUser } from '@/modules/identity';
import { toggleFollow } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Follow / bỏ follow một tài khoản (SPEC-social.md mục 1).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { userId } = (await request.json().catch(() => ({}))) as { userId?: unknown };
  if (typeof userId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const result = await toggleFollow(user.id, userId);
  const limit =
    !result.ok && result.error === 'FREE_LIMIT' ? await getIntSetting('social_free_daily_limit') : undefined;
  return Response.json({ ...result, limit });
}
