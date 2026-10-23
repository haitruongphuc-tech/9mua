import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { getCurrentUser } from '@/modules/identity';
import { MAX_VIDEO_BYTES, saveUpload } from '@/modules/creator';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  TOO_LARGE: 'Video tối đa 100MB.',
  DAILY_LIMIT: 'Mỗi ngày đăng tối đa 10 video. Hãy quay lại vào ngày mai.',
} as const;

// Bước 1 của đăng video: trình duyệt gửi thẳng file (PUT, có thanh tiến trình), server ghi luồng xuống đĩa.
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: 'Bạn cần đăng nhập.' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_VIDEO_BYTES)
    return Response.json({ ok: false, message: MESSAGES.TOO_LARGE }, { status: 413 });
  if (!request.body) return Response.json({ ok: false, message: 'Chưa chọn video.' }, { status: 400 });
  const result = await saveUpload(user.id, Readable.fromWeb(request.body as unknown as NodeWebStream));
  if (!result.ok)
    return Response.json(
      { ok: false, message: MESSAGES[result.error] },
      { status: result.error === 'TOO_LARGE' ? 413 : 429 },
    );
  return Response.json({ ok: true, uploadId: result.uploadId });
}
