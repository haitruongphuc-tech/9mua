import { flushAlerts } from '@/lib/alerts';
import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';

export const dynamic = 'force-dynamic';

// Cron mỗi 5 phút: gửi các cảnh báo đã gộp đang chờ (mỗi loại tối đa 1 email / 15 phút).
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json({ sent: await flushAlerts() });
}
