import { featureGuard } from '@/lib/features';
import { saveWatchProgress } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Nhớ tập và giây đang xem của người đã đăng nhập (SPEC-creator.md V5.9 mục 4).
export async function POST(request: Request) {
  const off = await featureGuard('watch');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { videoId?: unknown; second?: unknown } | null;
  if (!body || typeof body.videoId !== 'string' || typeof body.second !== 'number')
    return Response.json({ ok: false }, { status: 400 });
  return Response.json(await saveWatchProgress(user.id, body.videoId, body.second));
}
