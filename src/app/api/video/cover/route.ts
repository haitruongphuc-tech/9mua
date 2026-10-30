import { featureGuard } from '@/lib/features';
import { setVideoCover } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

const MAX_BODY = 10.5 * 1024 * 1024;

// Đổi ảnh bìa sau khi đăng (SPEC-creator.md V5.1 mục 6, V5.3 mục 7): chọn ảnh gợi ý (choice) hoặc tải ảnh riêng (file).
export async function POST(request: Request) {
  const off = await featureGuard('post_options');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return Response.json({ ok: false, error: 'TOO_LARGE' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const videoId = form?.get('videoId');
  if (typeof videoId !== 'string') return Response.json({ ok: false, error: 'NOT_FOUND' }, { status: 400 });
  const choice = form?.get('choice');
  const file = form?.get('file');
  const result =
    typeof choice === 'string'
      ? await setVideoCover(user.id, videoId, { choice })
      : file instanceof File
        ? await setVideoCover(user.id, videoId, { image: Buffer.from(await file.arrayBuffer()) })
        : ({ ok: false, error: 'NOT_AN_IMAGE' } as const);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
