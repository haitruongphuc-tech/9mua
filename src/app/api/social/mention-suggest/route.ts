import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { mentionSuggestions } from '@/modules/social';

export const dynamic = 'force-dynamic';

// Gợi ý khi gõ @ (SPEC-social.md V5.4 mục 2): người mình follow trước, rồi tìm theo @tên và tên hiển thị.
export async function GET(request: Request) {
  const off = await featureGuard('social_more');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [] }, { status: 401 });
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return Response.json(
    { items: await mentionSuggestions(user.id, q) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
