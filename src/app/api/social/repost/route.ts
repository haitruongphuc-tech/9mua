import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { toggleRepost } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Đăng lại / bỏ đăng lại video hoặc bài public của người khác (SPEC-social.md V5.9).
export async function POST(request: Request) {
  const off = await featureGuard('posts');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { videoId?: unknown; postId?: unknown };
  const target =
    typeof body.videoId === 'string'
      ? { videoId: body.videoId }
      : typeof body.postId === 'string'
        ? { postId: body.postId }
        : null;
  if (!target) return Response.json({ ok: false }, { status: 400 });
  const r = await toggleRepost(user.id, target);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
