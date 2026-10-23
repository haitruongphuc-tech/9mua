import { parseSearchParams, searchProducts } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Trang tiếp theo của Chợ cho cuộn vô hạn. Dữ liệu công khai, cho trình duyệt giữ 30 giây.
export async function GET(request: Request) {
  const params = parseSearchParams(Object.fromEntries(new URL(request.url).searchParams));
  const page = await searchProducts(params);
  return Response.json(page, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
