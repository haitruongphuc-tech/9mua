import { featureGuard } from '@/lib/features';
import { reportPost } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Báo cáo bài viết (SPEC-creator.md V5.10 mục 3): lý do như báo cáo video.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('posts');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const ok = await reportPost(
    user.id,
    (await params).id,
    typeof body?.reason === 'string' ? body.reason : '',
  );
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
