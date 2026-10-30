import { getT } from '@/i18n/server';
import { featureGuard } from '@/lib/features';
import { openUploadSession } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Mở phiên tải lên từng phần (SPEC-creator.md V5.1 mục 3): tên, dung lượng, thời lượng đo ở trình duyệt.
export async function POST(request: Request) {
  const off = await featureGuard('long_video');
  if (off) return off;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    size?: unknown;
    durationSec?: unknown;
  };
  const result = await openUploadSession(user.id, {
    name: typeof body.name === 'string' ? body.name : '',
    size: Number(body.size),
    durationSec: typeof body.durationSec === 'number' ? body.durationSec : null,
  });
  if (!result.ok)
    return Response.json(
      { ok: false, error: result.error, message: t(`post.err.${result.error}`) },
      { status: result.error === 'TOO_LARGE' ? 413 : 400 },
    );
  return Response.json(result);
}
