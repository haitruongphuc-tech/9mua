import { db } from '@/lib/db';
import { unreadCount } from '@/lib/notifications';
import { cached } from '@/lib/ttl-cache';
import { getCurrentUser } from '@/modules/identity';
import { anyLiveNow } from '@/modules/live';

export const dynamic = 'force-dynamic';

// Header gọi route này từ trình duyệt để các trang công khai vẫn cache được. liveNow: chấm đỏ ở nút Live của thanh
// dưới khi có ít nhất 1 buổi đang live (SPEC-live.md mục 4).
export async function GET() {
  const user = await getCurrentUser();
  const [cartCount, notifications, liveNow] = await Promise.all([
    user ? db.cartItem.count({ where: { userId: user.id } }) : 0,
    user ? unreadCount(user.id) : 0,
    cached('live-now', 10, anyLiveNow),
  ]);
  return Response.json(
    {
      user: user ? { displayName: user.displayName, role: user.role } : null,
      cartCount,
      notifications,
      liveNow,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
