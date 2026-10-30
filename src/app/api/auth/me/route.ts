import { db } from '@/lib/db';
import { unreadCount } from '@/lib/notifications';
import { featureStates } from '@/lib/features';
import { cached } from '@/lib/ttl-cache';
import { getCurrentUser } from '@/modules/identity';
import { anyLiveNow } from '@/modules/live';
import { unreadCount as inboxUnread } from '@/modules/messages';

export const dynamic = 'force-dynamic';

// Header gọi route này từ trình duyệt để các trang công khai vẫn cache được. liveNow: chấm đỏ ở nút Live của thanh
// dưới khi có ít nhất 1 buổi đang live (SPEC-live.md mục 4). inbox: số tin nhắn chưa đọc (SPEC-messages.md mục 1).
export async function GET() {
  const user = await getCurrentUser();
  const [cartCount, notifications, liveNow, inbox, features] = await Promise.all([
    user ? db.cartItem.count({ where: { userId: user.id } }) : 0,
    user ? unreadCount(user.id) : 0,
    cached('live-now', 10, anyLiveNow),
    user ? inboxUnread(user.id) : 0,
    cached('feature-states', 10, featureStates),
  ]);
  return Response.json(
    {
      user: user ? { displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role } : null,
      cartCount,
      notifications,
      liveNow,
      inbox,
      features: Object.fromEntries(features.map((f) => [f.name, f.on])),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
