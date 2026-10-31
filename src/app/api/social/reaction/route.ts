import { featureGuard } from '@/lib/features';
import { getIntSetting } from '@/lib/settings';
import { getCurrentUser } from '@/modules/identity';
import { isReaction, reactionSummary, setPostReaction, setVideoReaction } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Cảm xúc (SPEC-social.md V5.8): GET ?videoId= | ?postId= → số từng loại; POST chọn / đổi / bỏ cảm xúc.
export async function GET(request: Request) {
  const off = await featureGuard('posts');
  if (off) return off;
  const q = new URL(request.url).searchParams;
  const videoId = q.get('videoId');
  const postId = q.get('postId');
  if (!videoId && !postId) return Response.json({ counts: null }, { status: 400 });
  return Response.json({ counts: await reactionSummary(videoId ? { videoId } : { postId: postId! }) });
}

export async function POST(request: Request) {
  const off = await featureGuard('posts');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    videoId?: unknown;
    postId?: unknown;
    reaction?: unknown;
  };
  const reaction = body.reaction === null ? null : isReaction(body.reaction) ? body.reaction : undefined;
  if (reaction === undefined) return Response.json({ ok: false }, { status: 400 });
  const r =
    typeof body.videoId === 'string'
      ? await setVideoReaction(user.id, body.videoId, reaction)
      : typeof body.postId === 'string'
        ? await setPostReaction(user.id, body.postId, reaction)
        : null;
  if (!r) return Response.json({ ok: false }, { status: 400 });
  const limit =
    !r.ok && r.error === 'FREE_LIMIT' ? await getIntSetting('social_free_daily_limit') : undefined;
  return Response.json({ ...r, limit });
}
