import { getCurrentUser } from '@/modules/identity';
import { hideComment, pinComment, reportComment, unhideMutedComment } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Người đăng video ghim / ẩn bình luận; mọi người báo cáo bình luận (SPEC-social.md mục 3).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { commentId, action, reason } = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof commentId !== 'string') return Response.json({ ok: false }, { status: 400 });
  if (action === 'pin') return Response.json(await pinComment(commentId, user.id));
  if (action === 'hide') return Response.json(await hideComment(commentId, user.id));
  // Hiện lại bình luận bị ẩn vì từ cấm (SPEC-social.md V5.4 mục 3).
  if (action === 'unhide') return Response.json(await unhideMutedComment(commentId, user.id));
  if (action === 'report')
    return Response.json(
      await reportComment(user.id, commentId, typeof reason === 'string' ? reason : 'khac'),
    );
  return Response.json({ ok: false }, { status: 400 });
}
