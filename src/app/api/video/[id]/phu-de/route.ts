import { featureGuard } from '@/lib/features';
import { captionsForViewer } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Phụ đề WebVTT cho thẻ <track> (SPEC-creator.md V5.4): chỉ trả khi người xem được xem video và người đăng đã bật.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('auto_captions');
  if (off) return off;
  const user = await getCurrentUser();
  const vtt = await captionsForViewer((await params).id, user?.id);
  if (!vtt) return new Response(null, { status: 404 });
  return new Response(vtt, {
    headers: { 'content-type': 'text/vtt; charset=utf-8', 'cache-control': 'private, max-age=300' },
  });
}
