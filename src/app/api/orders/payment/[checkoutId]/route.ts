import { getCurrentUser } from '@/modules/identity';
import { getCheckoutForBuyer } from '@/modules/orders';
import { getPayment } from '@/server/payments';

export const dynamic = 'force-dynamic';

// Trạng thái thanh toán của một lần đặt hàng — chỉ người mua xem được.
export async function GET(_req: Request, { params }: { params: Promise<{ checkoutId: string }> }) {
  const user = await getCurrentUser();
  const checkout = user ? await getCheckoutForBuyer(user.id, (await params).checkoutId) : null;
  if (!checkout?.intentId) return Response.json({ status: null }, { status: 404 });
  const intent = await getPayment(checkout.intentId, { reconcile: true });
  return Response.json({ status: intent?.status ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
