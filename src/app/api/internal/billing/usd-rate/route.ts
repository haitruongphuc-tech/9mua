import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { updateKiotFeeFromRate } from '@/modules/billing';

export const dynamic = 'force-dynamic';

// Cron 7:00 mỗi sáng: giá Kiot 1 USD/năm theo tỷ giá bán USD của Vietcombank (SPEC-billing.md bổ sung 27/10).
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await updateKiotFeeFromRate());
}
