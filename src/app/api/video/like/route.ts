import { getIntSetting } from '@/lib/settings';
import { getCurrentUser } from '@/modules/identity';
import { heartVideo } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Thích video qua social để áp giới hạn tài khoản Free và tặng voucher (SPEC-social.md mục 7–8).
// mode 'like' = chạm 2 lần (chỉ thích), mặc định 'toggle' = nút tim.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { videoId, mode } = (await request.json().catch(() => ({}))) as { videoId?: unknown; mode?: unknown };
  if (typeof videoId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const result = await heartVideo(user.id, videoId, mode === 'like' ? 'like' : 'toggle');
  const limit =
    !result.ok && result.error === 'FREE_LIMIT' ? await getIntSetting('social_free_daily_limit') : undefined;
  return Response.json(
    { ...result, limit },
    { status: result.ok ? 200 : result.error === 'NOT_FOUND' ? 404 : 429 },
  );
}
