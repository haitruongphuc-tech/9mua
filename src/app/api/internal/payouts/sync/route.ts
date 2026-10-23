import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { syncProcessingPayouts } from '@/modules/payouts';

export const dynamic = 'force-dynamic';

// Cron mỗi 2 phút: hỏi PayOS trạng thái các lệnh chi đang chuyển, kiểm quỹ chi.
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await syncProcessingPayouts());
}
