import { getCurrentUser } from '@/modules/identity';
import { addComment, listComments } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Bình luận video (SPEC-social.md mục 3): GET danh sách, POST gửi bình luận / trả lời.
export async function GET(request: Request) {
  const videoId = new URL(request.url).searchParams.get('videoId');
  if (!videoId) return Response.json({ items: [], total: 0 }, { status: 400 });
  const user = await getCurrentUser();
  const list = await listComments(videoId, user?.id);
  return Response.json({ ...list, me: user?.id ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    videoId?: unknown;
    text?: unknown;
    parentId?: unknown;
  };
  if (typeof body.videoId !== 'string' || typeof body.text !== 'string')
    return Response.json({ ok: false }, { status: 400 });
  const parentId = typeof body.parentId === 'string' ? body.parentId : null;
  return Response.json(await addComment(user.id, body.videoId, body.text, parentId));
}
