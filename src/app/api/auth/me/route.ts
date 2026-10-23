import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Header gọi route này từ trình duyệt để các trang công khai vẫn cache được.
export async function GET() {
  const user = await getCurrentUser();
  return Response.json(
    { user: user ? { displayName: user.displayName, role: user.role } : null },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
