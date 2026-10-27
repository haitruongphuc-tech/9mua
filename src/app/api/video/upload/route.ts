import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { getT } from '@/i18n/server';
import { getCurrentUser } from '@/modules/identity';
import { MAX_VIDEO_BYTES, saveUpload } from '@/modules/creator';

export const dynamic = 'force-dynamic';

// Bước 1 của đăng video: trình duyệt gửi thẳng file (PUT, có thanh tiến trình), server ghi luồng xuống đĩa.
export async function PUT(request: Request) {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_VIDEO_BYTES)
    return Response.json({ ok: false, message: t('post.err.TOO_LARGE') }, { status: 413 });
  if (!request.body) return Response.json({ ok: false, message: t('post.err.upload') }, { status: 400 });
  const result = await saveUpload(user.id, Readable.fromWeb(request.body as unknown as NodeWebStream));
  if (!result.ok)
    return Response.json(
      { ok: false, message: t(`post.err.${result.error}`) },
      { status: result.error === 'TOO_LARGE' ? 413 : 429 },
    );
  return Response.json({ ok: true, uploadId: result.uploadId });
}
