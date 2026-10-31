import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { dismissSuggestion } from '@/modules/social';

export const dynamic = 'force-dynamic';

// "Ẩn" một gợi ý follow trong 30 ngày (SPEC-social.md V5.1 mục 2).
export async function POST(request: Request) {
  const off = await featureGuard('social_more');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { userId } = (await request.json().catch(() => ({}))) as { userId?: unknown };
  if (typeof userId !== 'string') return Response.json({ ok: false }, { status: 400 });
  await dismissSuggestion(user.id, userId);
  return Response.json({ ok: true });
}
