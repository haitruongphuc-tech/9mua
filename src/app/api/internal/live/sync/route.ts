import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { syncWithMediaServer } from '@/server/live';

export const dynamic = 'force-dynamic';

// Production: worker gọi syncWithMediaServer mỗi 5 giây. Route này cho E2E (và kiểm tra tay) gọi ngay một lần.
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await syncWithMediaServer());
}
