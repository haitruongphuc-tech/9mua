import { isFeatureOn } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { hotKeywords, searchHistory, suggest } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Gợi ý khi gõ; ô trống thì lịch sử của tôi + từ khoá hot (SPEC-marketplace.md V5.4).
export async function GET(request: Request) {
  if (!(await isFeatureOn('search_more'))) return Response.json({ suggestions: [], history: [], hot: [] });
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q)
    return Response.json({ suggestions: await suggest(q) }, { headers: { 'Cache-Control': 'no-store' } });
  const user = await getCurrentUser();
  const [history, hot] = await Promise.all([user ? searchHistory(user.id) : [], hotKeywords()]);
  return Response.json({ suggestions: [], history, hot }, { headers: { 'Cache-Control': 'no-store' } });
}
