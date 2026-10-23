import { db } from '@/lib/db';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Header gọi route này từ trình duyệt để các trang công khai vẫn cache được.
export async function GET() {
  const user = await getCurrentUser();
  const cartCount = user ? await db.cartItem.count({ where: { userId: user.id } }) : 0;
  return Response.json(
    { user: user ? { displayName: user.displayName, role: user.role } : null, cartCount },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
