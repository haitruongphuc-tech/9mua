import { getCurrentUser } from '@/modules/identity';
import { listProductsForOwner } from '@/modules/kiot';
import { searchProducts } from '@/modules/marketplace';

export const dynamic = 'force-dynamic';

export type PickableProduct = {
  id: string;
  name: string;
  price: number;
  thumbUrl: string | null;
  kiotName: string;
  mine: boolean;
};

// Tìm sản phẩm để gắn vào video: mọi Kiot đang hoạt động, sản phẩm Kiot của mình lên trước.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ items: [] }, { status: 401 });
  const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 100) ?? '';
  const own = (await listProductsForOwner(user.id)).filter(
    (p) => p.visible && !p.hiddenByAdminAt && p.stock > 0,
  );
  const ownIds = new Set(own.map((p) => p.id));
  const found = q ? (await searchProducts({ q, sort: 'phu-hop' }, 20)).items : [];
  const items: PickableProduct[] = [
    ...found.filter((p) => ownIds.has(p.id)).map((p) => ({ ...p, mine: true })),
    ...(q
      ? []
      : own.slice(0, 10).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          thumbUrl: p.images[0]?.thumbUrl ?? null,
          kiotName: 'Kiot của tôi',
          mine: true,
        }))),
    ...found.filter((p) => !ownIds.has(p.id)).map((p) => ({ ...p, mine: false })),
  ]
    .slice(0, 12)
    .map(({ id, name, price, thumbUrl, kiotName, mine }) => ({ id, name, price, thumbUrl, kiotName, mine }));
  return Response.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
}
