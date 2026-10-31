import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { featureGuard } from '@/lib/features';
import { PART_SIZE, putUploadPart } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Một phần 8MB (Nginx giới hạn 10MB cho đường này). Gửi lại phần đã có thì bỏ qua, không lỗi.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const off = await featureGuard('long_video');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > PART_SIZE)
    return Response.json({ ok: false, error: 'BAD_PART' }, { status: 413 });
  if (!request.body) {
    console.warn('[upload] phần gửi lên không có dữ liệu');
    return Response.json({ ok: false, error: 'BAD_PART' }, { status: 400 });
  }
  const { id, n } = await params;
  const result = await putUploadPart(
    user.id,
    id,
    /^\d{1,6}$/.test(n) ? Number(n) : -1,
    Readable.fromWeb(request.body as unknown as NodeWebStream),
  );
  return Response.json(result, { status: result.ok ? 200 : result.error === 'NOT_FOUND' ? 404 : 400 });
}
