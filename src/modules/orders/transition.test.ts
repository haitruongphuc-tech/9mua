import { describe, expect, it } from 'vitest';
import '@/server/payments';
import { db } from '@/lib/db';
import { getOutbox } from '@/lib/mail';
import { changeEmail } from '@/modules/identity';
import {
  createPaidOrder,
  createProduct,
  createSeller,
  createUser,
  sampleAddress,
} from '../../../tests/helpers/factories';
import { addToCart } from './cart';
import { placeOrder } from './place-order';
import { getOrderForSeller, listOrdersForKiot, transition } from './transition';

describe('người bán xử lý đơn', () => {
  it('xác nhận → giao hàng (mã vận đơn); có lịch sử và email cho người mua', async () => {
    const { seller, buyer, order } = await createPaidOrder();
    await changeEmail(buyer.id, { email: 'khach@9mua.com', password: buyer.password });
    expect(await transition(order.id, 'confirm', { userId: seller.user.id, role: 'seller' })).toEqual({
      ok: true,
    });
    expect(
      await transition(
        order.id,
        'ship',
        { userId: seller.user.id, role: 'seller' },
        { trackingCode: 'GHN123', carrier: 'GHN' },
      ),
    ).toEqual({ ok: true });
    const saved = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    expect(saved).toMatchObject({ status: 'shipping', trackingCode: 'GHN123', carrier: 'GHN' });
    expect(saved.confirmedAt).not.toBeNull();
    expect(saved.events.map((e) => e.action)).toEqual(['place', 'pay', 'confirm', 'ship']);
    expect(getOutbox().some((m) => m.to === 'khach@9mua.com' && m.text.includes('GHN123'))).toBe(true);
  });

  it('từ chối cần lý do; hoàn tồn kho; đơn chuyển refund_pending', async () => {
    const { seller, order, product } = await createPaidOrder({ qty: 2, stock: 5 });
    expect(await transition(order.id, 'reject', { userId: seller.user.id, role: 'seller' })).toMatchObject({
      ok: false,
      error: 'REASON_REQUIRED',
    });
    expect(
      await transition(
        order.id,
        'reject',
        { userId: seller.user.id, role: 'seller' },
        { reason: 'Hết hàng thật' },
      ),
    ).toEqual({ ok: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('refund_pending');
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5);
  });

  it('người bán A không thao tác được đơn của Kiot B; người mua không xác nhận được đơn', async () => {
    const { order, buyer } = await createPaidOrder();
    const other = await createSeller({ active: true });
    expect(await transition(order.id, 'confirm', { userId: other.user.id, role: 'seller' })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
    expect(await transition(order.id, 'confirm', { userId: buyer.id, role: 'buyer' })).toEqual({
      ok: false,
      error: 'INVALID_TRANSITION',
    });
    expect(await getOrderForSeller(other.user.id, order.id)).toBeNull();
  });

  it('chuyển sai trạng thái bị từ chối (giao hàng khi chưa xác nhận)', async () => {
    const { seller, order } = await createPaidOrder();
    expect(await transition(order.id, 'ship', { userId: seller.user.id, role: 'seller' })).toEqual({
      ok: false,
      error: 'INVALID_TRANSITION',
    });
  });

  it('người bán chỉ thấy địa chỉ/SĐT người mua khi đơn đã thanh toán', async () => {
    const seller = await createSeller({ active: true });
    const buyer = await createUser();
    const p = await createProduct(seller.kiotId);
    await addToCart(buyer.id, p.id, 1);
    const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
    if (!r.ok) throw new Error();
    const unpaid = await listOrdersForKiot(seller.user.id, {});
    expect(unpaid[0]!.shipTo).toBeNull();
    expect(JSON.stringify(unpaid)).not.toContain('912345678');

    const { seller: s2, order } = await createPaidOrder();
    const paid = await getOrderForSeller(s2.user.id, order.id);
    expect(paid?.shipTo).toMatchObject({ phone: '+84912345678', line: '115 Nguyễn Hậu' });
  });

  it('lọc đơn theo trạng thái', async () => {
    const { seller, order } = await createPaidOrder();
    expect((await listOrdersForKiot(seller.user.id, { status: ['paid'] })).map((o) => o.id)).toEqual([
      order.id,
    ]);
    expect(await listOrdersForKiot(seller.user.id, { status: ['shipping'] })).toEqual([]);
  });
});
