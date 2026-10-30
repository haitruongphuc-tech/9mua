import { featureGuard } from '@/lib/features';
import { togglePostLike } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Thích / bỏ thích bài viết (SPEC-creator.md V5.10 mục 3).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('posts');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  return Response.json(await togglePostLike(user.id, (await params).id));
}
