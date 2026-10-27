import { getIntSetting } from '@/lib/settings';
import { getCurrentUser } from '@/modules/identity';
import { toggleFollow } from '@/modules/social';
import { followKiotOwner } from '@/server/kiot-page';

export const dynamic = 'force-dynamic';

// Follow / bỏ follow một tài khoản (SPEC-social.md mục 1). Trang Kiot gửi kiotId: follow chủ Kiot đó.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { userId?: unknown; kiotId?: unknown };
  const result =
    typeof body.kiotId === 'string'
      ? await followKiotOwner(user.id, body.kiotId)
      : typeof body.userId === 'string'
        ? await toggleFollow(user.id, body.userId)
        : null;
  if (!result) return Response.json({ ok: false }, { status: 400 });
  const limit =
    !result.ok && result.error === 'FREE_LIMIT' ? await getIntSetting('social_free_daily_limit') : undefined;
  return Response.json({ ...result, limit });
}
