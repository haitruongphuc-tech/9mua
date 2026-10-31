import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { reportEvent } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Báo cáo sự kiện (SPEC-social.md V5.7 mục 1): 5 người báo cáo thì tự ẩn chờ CEO xem.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('events');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: await reportEvent(user.id, (await params).id, 'khac') });
}
