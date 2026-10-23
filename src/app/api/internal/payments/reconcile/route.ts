import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { reconcilePending } from '@/server/payments';

export const dynamic = 'force-dynamic';

// Cron mỗi 5 phút: hỏi lại PayOS các khoản đang chờ, phòng webhook bị mất (SPEC-payments.md mục 3).
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await reconcilePending());
}
