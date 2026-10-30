import { featureGuard } from '@/lib/features';
import { setSeriesCover } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

const MAX_BODY = 10.5 * 1024 * 1024;

// Ảnh bìa phim 2:3 (SPEC-creator.md V5.9 mục 1). Form gửi thẳng tới đây (server action chỉ nhận 1MB).
export async function POST(request: Request) {
  const off = await featureGuard('watch');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const form =
    Number(request.headers.get('content-length') ?? 0) > MAX_BODY
      ? null
      : await request.formData().catch(() => null);
  const seriesId = String(form?.get('seriesId') ?? '');
  const file = form?.get('file');
  const r =
    file instanceof File && file.size > 0
      ? await setSeriesCover(user.id, seriesId, Buffer.from(await file.arrayBuffer()))
      : ({ ok: false, error: 'NOT_AN_IMAGE' } as const);
  const back = `/video/cua-toi/phim/${encodeURIComponent(seriesId)}?${r.ok ? 'xong=1' : `loi=COVER_${r.error}`}`;
  return Response.redirect(new URL(back, request.url), 303);
}
