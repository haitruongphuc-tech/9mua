import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { listConversations } from '@/modules/messages';

export const dynamic = 'force-dynamic';

// Bảng chia sẻ (SPEC-messages.md V5.1): 8 cuộc trò chuyện gần nhất, hoặc tìm theo tên trong các cuộc đã có.
export async function GET(request: Request) {
  const off = await featureGuard('share_more');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [] }, { status: 401 });
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLocaleLowerCase('vi');
  const all = await listConversations(user.id, 'inbox');
  const items = all
    .map((c) => ({
      conversationId: c.id,
      name: c.other.kiotName ?? c.other.displayName,
      avatarUrl: c.other.avatarUrl,
    }))
    .filter((c) => !q || c.name.toLocaleLowerCase('vi').includes(q))
    .slice(0, 8);
  return Response.json({ items });
}
