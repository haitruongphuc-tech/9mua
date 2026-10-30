import { featureGuard } from '@/lib/features';
import { toggleSeriesFollow } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// "Lưu phim" / bỏ lưu (SPEC-creator.md V5.9 mục 4): có tập mới thì nhận thông báo.
export async function POST(request: Request) {
  const off = await featureGuard('watch');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, following: false }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { seriesId?: unknown } | null;
  if (!body || typeof body.seriesId !== 'string')
    return Response.json({ ok: false, following: false }, { status: 400 });
  return Response.json(await toggleSeriesFollow(user.id, body.seriesId));
}
