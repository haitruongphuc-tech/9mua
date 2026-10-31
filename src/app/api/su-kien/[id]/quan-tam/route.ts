import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { toggleEventInterest } from '@/modules/social';

export const dynamic = 'force-dynamic';

// "Quan tâm" / bỏ quan tâm sự kiện (SPEC-social.md V5.7 mục 1).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('events');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  return Response.json(await toggleEventInterest(user.id, (await params).id));
}
