import { featureGuard } from '@/lib/features';
import { kiotHeatmap, validBounds } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Ô lưới bản đồ nhiệt trong khung đang xem (SPEC-marketplace.md V5.3).
export async function GET(request: Request) {
  const off = await featureGuard('map');
  if (off) return off;
  const p = new URL(request.url).searchParams;
  const b = validBounds({
    south: p.get('south'),
    west: p.get('west'),
    north: p.get('north'),
    east: p.get('east'),
  });
  if (!b) return Response.json({ cells: [] }, { status: 400 });
  return Response.json(await kiotHeatmap(b), { headers: { 'Cache-Control': 'public, max-age=60' } });
}
