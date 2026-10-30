import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { toggleCommentLike } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Tim / bỏ tim bình luận (SPEC-social.md V5.4 mục 1), tối đa 60 lần mỗi phút.
export async function POST(request: Request) {
  const off = await featureGuard('social_more');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { commentId } = (await request.json().catch(() => ({}))) as { commentId?: unknown };
  if (typeof commentId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const r = await toggleCommentLike(user.id, commentId);
  return Response.json(r, { status: r.ok ? 200 : r.error === 'RATE_LIMIT' ? 429 : 404 });
}
