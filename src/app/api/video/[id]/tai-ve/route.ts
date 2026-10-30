import { getT } from '@/i18n/server';
import { featureGuard } from '@/lib/features';
import { requestDownload } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Tải về có logo (SPEC-creator.md V5.7 mục 1). Lần đầu trả { pending } — trình duyệt hỏi lại sau vài giây.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('share_more');
  if (off) return off;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('feed.share.err.LOGIN') }, { status: 401 });
  const r = await requestDownload(user.id, (await params).id);
  if (!r.ok) return Response.json({ ok: false, message: t(`feed.share.err.${r.error}`) }, { status: 400 });
  return Response.json(r);
}
