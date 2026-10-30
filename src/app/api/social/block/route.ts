import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { blockUser, unblockUser } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Chặn / bỏ chặn một người trên toàn web (SPEC-social.md V5.3). Công tắc social_more tắt thì như không có route này.
export async function POST(request: Request) {
  const off = await featureGuard('social_more');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const { userId, unblock } = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof userId !== 'string' || !userId) return Response.json({ ok: false }, { status: 400 });
  return Response.json(
    unblock === true ? await unblockUser(user.id, userId) : await blockUser(user.id, userId),
  );
}
