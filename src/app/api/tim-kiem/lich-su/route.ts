import { getCurrentUser } from '@/modules/identity';
import { clearSearchHistory } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Xoá một từ khoá (q) hoặc xoá hết lịch sử tìm của tôi (SPEC-marketplace.md V5.4 mục 2).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { q?: unknown };
  await clearSearchHistory(user.id, typeof body.q === 'string' ? body.q : undefined);
  return Response.json({ ok: true });
}
