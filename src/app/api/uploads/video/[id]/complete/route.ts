import { getT } from '@/i18n/server';
import { featureGuard } from '@/lib/features';
import { completeUploadSession } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Đủ phần: máy chủ ghép file, trả uploadId để tạo video như đường tải một lần.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('long_video');
  if (off) return off;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  const result = await completeUploadSession(user.id, (await params).id);
  if (!result.ok)
    return Response.json(
      { ok: false, error: result.error, message: t(`post.err.${result.error}`) },
      { status: 400 },
    );
  return Response.json(result);
}
