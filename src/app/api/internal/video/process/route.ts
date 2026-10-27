import { env } from '@/lib/env';
import { isInternalRequest, notFoundResponse } from '@/lib/internal-route';
import { processNextJob } from '@/server/creator';

export const dynamic = 'force-dynamic';

// CHỈ dùng khi chạy E2E (TEST_MODE=e2e): xử lý hàng đợi video ngay thay cho service worker.
// Production: video do container worker xử lý, route này luôn 404.
export async function GET(request: Request) {
  if (env().TEST_MODE !== 'e2e' || !isInternalRequest(request)) return notFoundResponse();
  let processed = 0;
  while (processed < 10 && (await processNextJob())) processed += 1;
  return Response.json({ processed });
}
