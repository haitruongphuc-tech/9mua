import { getCurrentUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { getPayment } from '@/server/payments';

export const dynamic = 'force-dynamic';

// Trạng thái thanh toán phí thuê, chỉ chủ Kiot xem được. Còn chờ thì hỏi lại PayOS (tối đa mỗi 10 giây).
export async function GET(_req: Request, { params }: { params: Promise<{ intentId: string }> }) {
  const user = await getCurrentUser();
  const kiot = user ? await getKiotByOwner(user.id) : null;
  const intent = kiot ? await getPayment((await params).intentId, { reconcile: true }) : null;
  if (!kiot || !intent || intent.purpose !== 'kiot_fee' || intent.refId !== kiot.id) {
    return Response.json({ status: null }, { status: 404 });
  }
  return Response.json({ status: intent.status }, { headers: { 'Cache-Control': 'no-store' } });
}
