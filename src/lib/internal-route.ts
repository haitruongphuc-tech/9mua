import { createHash, timingSafeEqual } from 'node:crypto';

// Route /api/internal/* chỉ cho cron trên VPS gọi (Nginx trả 404 từ Internet). Trong Docker app không
// phân biệt được IP người gọi, nên kiểm header X-Internal-Token bằng so sánh thời gian hằng.
export function isInternalRequest(request: Request): boolean {
  const expected = process.env.INTERNAL_CRON_TOKEN ?? '';
  const given = request.headers.get('x-internal-token') ?? '';
  if (!expected || !given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function notFoundResponse(): Response {
  return new Response('Not found', { status: 404 });
}
