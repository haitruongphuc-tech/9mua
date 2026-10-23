import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { refreshSales30d } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Cron hằng đêm: tính lại "đã bán 30 ngày" cho mục Bán chạy.
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await refreshSales30d());
}
