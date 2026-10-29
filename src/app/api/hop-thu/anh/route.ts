import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/modules/identity';
import { saveMessageImage } from '@/modules/messages';

export const dynamic = 'force-dynamic';

const MAX_BODY = 5 * 1024 * 1024 + 64 * 1024;

// Tải ảnh để gửi trong tin nhắn (SPEC-messages.md mục 4). Ảnh lưu riêng tư, trả về mã ảnh để gắn vào tin.
export async function POST(request: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('inbox.err.NOT_MEMBER') }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return Response.json({ ok: false, message: t('inbox.err.TOO_LARGE') }, { status: 413 });
  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File))
    return Response.json({ ok: false, message: t('inbox.err.NOT_AN_IMAGE') }, { status: 400 });
  const r = await saveMessageImage(user.id, Buffer.from(await file.arrayBuffer()));
  if (!r.ok) return Response.json({ ok: false, message: t(`inbox.err.${r.error}`) }, { status: 400 });
  return Response.json({ ok: true, imageId: r.imageId, url: `/api/hop-thu/anh/${r.imageId}` });
}
