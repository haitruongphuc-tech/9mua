import { featureGuard } from '@/lib/features';
import { pinToProfile } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Ghim / bỏ ghim video của mình lên đầu trang cá nhân từ nút ⋯ của feed (SPEC-creator.md V5.3, tối đa 3).
export async function POST(request: Request) {
  const off = await featureGuard('post_options');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const { videoId, on } = (await request.json().catch(() => ({}))) as { videoId?: unknown; on?: unknown };
  if (typeof videoId !== 'string') return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 400 });
  return Response.json(await pinToProfile(user.id, videoId, on === true));
}
