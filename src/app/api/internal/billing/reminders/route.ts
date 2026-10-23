import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { sendExpiryReminders } from '@/modules/billing';

export const dynamic = 'force-dynamic';

// Cron 8:00 mỗi ngày: email nhắc gia hạn ở mốc 14 ngày, 3 ngày, ngày hết hạn.
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await sendExpiryReminders());
}
