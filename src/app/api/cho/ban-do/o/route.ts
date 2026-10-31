import { featureGuard } from '@/lib/features';
import { searchKiots } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

// Bấm một ô trên bản đồ nhiệt: danh sách Kiot trong ô đó (SPEC-marketplace.md V5.3 mục 3).
export async function GET(request: Request) {
  const off = await featureGuard('map');
  if (off) return off;
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Response.json({ kiots: [] }, { status: 400 });
  const page = await searchKiots({ cell: { lat, lng }, limit: 50 });
  return Response.json({ kiots: page.items });
}
