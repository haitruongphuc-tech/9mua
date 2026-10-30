import { featureGuard } from '@/lib/features';
import { savePostImage } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

const MAX_BODY = 10.5 * 1024 * 1024;

// Tải một ảnh cho bài viết (SPEC-creator.md V5.10): JPG/PNG/WebP ≤ 10MB, xử lý như ảnh sản phẩm.
export async function POST(request: Request) {
  const off = await featureGuard('posts');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return Response.json({ ok: false, error: 'TOO_LARGE' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ ok: false, error: 'NOT_AN_IMAGE' }, { status: 400 });
  const r = await savePostImage(user.id, Buffer.from(await file.arrayBuffer()));
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
