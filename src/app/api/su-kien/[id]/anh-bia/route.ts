import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { setEventCover } from '@/modules/social';

export const dynamic = 'force-dynamic';

const MAX_BODY = 10.5 * 1024 * 1024;

// Ảnh bìa sự kiện 16:9 (SPEC-social.md V5.7 mục 1). Form gửi thẳng tới đây (server action chỉ nhận 1MB).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('events');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const form =
    Number(request.headers.get('content-length') ?? 0) > MAX_BODY
      ? null
      : await request.formData().catch(() => null);
  const file = form?.get('file');
  const r =
    file instanceof File && file.size > 0
      ? await setEventCover(user.id, id, Buffer.from(await file.arrayBuffer()))
      : { ok: false };
  return Response.redirect(
    new URL(`/su-kien/${encodeURIComponent(id)}${r.ok ? '' : '?loi=anh'}`, request.url),
    303,
  );
}
