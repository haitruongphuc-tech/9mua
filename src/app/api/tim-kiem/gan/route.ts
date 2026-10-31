import { featureGuard } from '@/lib/features';
import { validLatLng } from '@/modules/kiot';
import { NEAR_RADII, searchKiots, searchProducts } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Gần tôi (SPEC-marketplace.md V5.2): vị trí gửi bằng POST, chỉ dùng tính khoảng cách cho lần tìm này — không lưu, không
// ghi log, không nằm trên URL.
export async function POST(request: Request) {
  const off = await featureGuard('search_more');
  if (off) return off;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const radiusKm = NEAR_RADII.find((r) => r === Number(body.radiusKm)) ?? 10;
  if (!validLatLng(lat, lng)) return Response.json({ ok: false }, { status: 400 });
  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 100) : '';
  const near = { lat, lng, radiusKm };
  if (body.tab === 'san-pham') {
    const page = await searchProducts({ q, sort: 'phu-hop' }, 30, near);
    return Response.json({ ok: true, products: page.items }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const page = await searchKiots({ q, near });
  return Response.json({ ok: true, kiots: page.items }, { headers: { 'Cache-Control': 'no-store' } });
}
