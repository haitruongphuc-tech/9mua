import { hasInternalKey, notFoundResponse } from '@/lib/internal-route';
import { authorizeMedia } from '@/modules/live';

export const dynamic = 'force-dynamic';

// MediaMTX hỏi trước mỗi kết nối phát/xem (authMethod: http — SPEC-live.md "Kỹ thuật"). 200 = cho, 401 = chặn.
// Mã phát / mã xem gửi bằng "Authorization: Bearer", MediaMTX chuyển vào trường token.
export async function POST(request: Request) {
  if (!hasInternalKey(request)) return notFoundResponse();
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    path?: string;
    token?: string;
    password?: string;
  } | null;
  const ok = await authorizeMedia({
    action: body?.action ?? '',
    path: body?.path ?? '',
    token: body?.token || body?.password || '',
  });
  return new Response(null, { status: ok ? 200 : 401 });
}
