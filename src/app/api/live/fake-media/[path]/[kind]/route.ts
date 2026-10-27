import { env } from '@/lib/env';
import { notFoundResponse } from '@/lib/internal-route';
import { authorizeMedia, fakeMedia } from '@/modules/live';

export const dynamic = 'force-dynamic';

// CHỈ khi TEST_MODE=e2e: giả MediaMTX (máy chạy E2E không có máy chủ hình). Trình duyệt gửi WHIP/WHEP như thật,
// route kiểm mã phát / mã xem bằng đúng hàm của MediaMTX thật rồi đánh dấu "có hình". Production luôn 404.
type Ctx = { params: Promise<{ path: string; kind: string }> };

export async function POST(request: Request, { params }: Ctx) {
  if (env().TEST_MODE !== 'e2e') return notFoundResponse();
  const { path, kind } = await params;
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const action = kind === 'whip' ? 'publish' : kind === 'whep' ? 'read' : '';
  if (!(await authorizeMedia({ action, path, token }))) return new Response(null, { status: 401 });
  if (action === 'publish') fakeMedia.setReady(path, true);
  return new Response('', {
    status: 201,
    headers: { 'x-fake-media': '1', 'content-type': 'application/sdp' },
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (env().TEST_MODE !== 'e2e') return notFoundResponse();
  const { path, kind } = await params;
  if (kind === 'whip') fakeMedia.setReady(path, false);
  return new Response(null, { status: 200 });
}
