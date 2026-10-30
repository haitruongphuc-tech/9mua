import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { runDaily } from '@/server/periodic';

export const dynamic = 'force-dynamic';

// Cron mỗi ngày: việc định kỳ của đợt nâng cấp (src/server/periodic.ts).
export async function GET(request: Request) {
  if (!isInternalRequest(request)) return notFoundResponse();
  return Response.json(await runDaily());
}
