import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { runOrderTick } from '@/server/orders';

export const dynamic = 'force-dynamic';

// Cron mỗi 5 phút: huỷ đơn quá hạn trả, tự hoàn tiền/đã giao/hoàn tất theo mốc thời gian.
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await runOrderTick());
}
