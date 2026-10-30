import { ensureAnonId } from '@/lib/anon-id';
import { featureGuard } from '@/lib/features';
import { markNotInterested } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// "Không quan tâm" một video (SPEC-creator.md V5.2). Khách chưa đăng nhập dùng mã ẩn danh như lượt xem.
export async function POST(request: Request) {
  const off = await featureGuard('feed_tools');
  if (off) return off;
  const { videoId } = (await request.json().catch(() => ({}))) as { videoId?: unknown };
  if (typeof videoId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const user = await getCurrentUser();
  return Response.json(
    await markNotInterested({ userId: user?.id, anonId: user ? undefined : await ensureAnonId() }, videoId),
  );
}
