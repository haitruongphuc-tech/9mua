import { readAnonId } from '@/lib/anon-id';
import { getCurrentUser } from '@/modules/identity';
import { loadFeed } from '@/server/feed';

export const dynamic = 'force-dynamic';

// Cuộn tiếp feed; tab=following cho tab "Đang Follow" (SPEC-social.md mục 2).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const user = await getCurrentUser();
  const tab = params.get('tab') === 'following' ? 'following' : 'for-you';
  const page = await loadFeed(
    { userId: user?.id, anonId: await readAnonId() },
    { tab, cursor: params.get('sau') ?? undefined },
  );
  return Response.json(page, { headers: { 'Cache-Control': 'private, no-store' } });
}
