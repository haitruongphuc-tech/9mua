import { getT } from '@/i18n/server';
import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { sendMessage } from '@/modules/messages';

export const dynamic = 'force-dynamic';

// Gửi thẻ video từ bảng chia sẻ (SPEC-messages.md V5.1): luật như tin thường (không link, chặn, cấm, gửi nhanh).
export async function POST(request: Request) {
  const off = await featureGuard('share_more');
  if (off) return off;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('feed.share.err.LOGIN') }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    conversationId?: unknown;
    videoId?: unknown;
    text?: unknown;
  } | null;
  if (!body || typeof body.conversationId !== 'string' || typeof body.videoId !== 'string')
    return Response.json({ ok: false, message: t('inbox.err.VIDEO_INVALID') }, { status: 400 });
  const r = await sendMessage(user.id, body.conversationId, {
    videoId: body.videoId,
    text: typeof body.text === 'string' ? body.text : null,
  });
  if (!r.ok) return Response.json({ ok: false, message: t(`inbox.err.${r.error}`) }, { status: 400 });
  return Response.json({ ok: true });
}
