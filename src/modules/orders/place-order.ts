import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { getIntSetting } from '@/lib/settings';
import { decrementStock, isKiotActive, OutOfStockError, tryDecrementStock } from '@/modules/kiot';
import { cancelPayment, createPayment, type AfterCommit, type PaidIntent } from '@/modules/payments';
import { parseAddress, type AddressField } from './address';
import { getCart } from './cart';
import { shippingFeeFor } from './shipping';
import { applyAction } from './transition-core';

export const PAYMENT_TTL_MINUTES = 15;

export type PlaceOrderResult =
  | { ok: true; checkoutId: string; intentId: string }
  | { ok: false; error: 'EMPTY_CART' | 'PAYMENT_UNAVAILABLE' }
  | { ok: false; error: 'CART_INVALID' | 'OUT_OF_STOCK'; productIds: string[] }
  | { ok: false; error: 'INVALID_ADDRESS'; fields: Partial<Record<AddressField, string>> };

class Unavailable extends Error {
  constructor(readonly productIds: string[]) {
    super('Sản phẩm không còn bán');
  }
}

export async function placeOrder(
  userId: string,
  input: { address: Record<string, string>; notes: Record<string, string>; saveAddress: boolean },
): Promise<PlaceOrderResult> {
  const cart = await getCart(userId);
  if (cart.lineCount === 0) return { ok: false, error: 'EMPTY_CART' };
  if (!cart.canCheckout) {
    return {
      ok: false,
      error: 'CART_INVALID',
      productIds: cart.groups.flatMap((g) => g.lines.filter((l) => l.problem).map((l) => l.productId)),
    };
  }
  const parsed = parseAddress(input.address);
  if (!parsed.ok) return { ok: false, error: 'INVALID_ADDRESS', fields: parsed.fields };
  const address = parsed.address;
  const feeRate = await getIntSetting('platform_fee_bp');
  const lines = cart.groups.flatMap((g) => g.lines);

  let created: { checkoutId: string; total: number; firstCode: string; orderIds: string[] };
  try {
    created = await db.$transaction(async (tx) => {
      // Giữ hàng trước: UPDATE có điều kiện nên 2 người mua món cuối thì chỉ 1 người qua.
      await decrementStock(
        tx,
        lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      );

      // Đọc lại giá và trạng thái trong transaction — không tin số liệu đã hiển thị cho người mua.
      const products = await tx.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
        include: { kiot: true, images: { orderBy: { position: 'asc' }, take: 1 } },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const at = now();
      const bad = products.filter(
        (p) =>
          !p.visible ||
          p.deletedAt ||
          p.hiddenByAdminAt ||
          !isKiotActive(p.kiot, at) ||
          p.kiot.ownerId === userId,
      );
      if (bad.length) throw new Unavailable(bad.map((p) => p.id));

      const groups = new Map<string, typeof lines>();
      for (const l of lines) {
        const kiotId = byId.get(l.productId)!.kiotId;
        groups.set(kiotId, [...(groups.get(kiotId) ?? []), l]);
      }

      const checkout = await tx.checkout.create({ data: { buyerId: userId, total: 0, createdAt: at } });
      let total = 0;
      let firstCode = '';
      const orderIds: string[] = [];
      for (const [kiotId, groupLines] of groups) {
        const kiot = byId.get(groupLines[0]!.productId)!.kiot;
        const subtotal = groupLines.reduce((s, l) => s + byId.get(l.productId)!.price * l.qty, 0);
        const shippingFee = shippingFeeFor(subtotal, kiot);
        const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_code_seq') AS n`;
        const code = `DH${seq[0]!.n}`;
        firstCode ||= code;
        const order = await tx.order.create({
          data: {
            code,
            checkoutId: checkout.id,
            kiotId,
            buyerId: userId,
            subtotal,
            shippingFee,
            total: subtotal + shippingFee,
            platformFeeRate: feeRate,
            shipTo: address,
            note: input.notes[kiotId]?.trim().slice(0, 500) || null,
            createdAt: at,
            items: {
              create: groupLines.map((l) => {
                const p = byId.get(l.productId)!;
                return {
                  productId: p.id,
                  name: p.name,
                  price: p.price,
                  qty: l.qty,
                  imageUrl: p.images[0]?.thumbUrl ?? null,
                  sourceVideoId: l.sourceVideoId,
                  sourceLiveId: l.sourceLiveId,
                };
              }),
            },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            from: null,
            to: 'pending_payment',
            action: 'place',
            actorId: userId,
            actorRole: 'buyer',
            createdAt: at,
          },
        });
        total += order.total;
        orderIds.push(order.id);
      }
      await tx.checkout.update({ where: { id: checkout.id }, data: { total } });
      await tx.cartItem.deleteMany({ where: { userId, productId: { in: lines.map((l) => l.productId) } } });
      if (input.saveAddress) {
        await tx.buyerAddress.upsert({ where: { userId }, create: { userId, ...address }, update: address });
      }
      return { checkoutId: checkout.id, total, firstCode, orderIds };
    });
  } catch (error) {
    if (error instanceof OutOfStockError)
      return { ok: false, error: 'OUT_OF_STOCK', productIds: [error.productId] };
    if (error instanceof Unavailable)
      return { ok: false, error: 'CART_INVALID', productIds: error.productIds };
    throw error;
  }

  try {
    const intent = await createPayment({
      purpose: 'order',
      refId: created.checkoutId,
      amount: created.total,
      description: created.firstCode,
      returnPath: `/dat-hang/${created.checkoutId}`,
      ttlMinutes: PAYMENT_TTL_MINUTES,
    });
    await db.checkout.update({ where: { id: created.checkoutId }, data: { intentId: intent.intentId } });
    return { ok: true, checkoutId: created.checkoutId, intentId: intent.intentId };
  } catch (error) {
    // Không tạo được QR (PayOS lỗi): huỷ đơn, trả hàng về kho để không giữ hàng vô thời hạn.
    console.error('[orders] Không tạo được thanh toán, huỷ checkout:', error);
    await db.$transaction(async (tx) => {
      for (const id of created.orderIds)
        await applyAction(
          tx,
          id,
          'expire',
          { id: null, role: 'system' },
          { reason: 'Không tạo được thanh toán' },
        );
      await tx.checkout.update({ where: { id: created.checkoutId }, data: { status: 'cancelled' } });
    });
    return { ok: false, error: 'PAYMENT_UNAVAILABLE' };
  }
}

// Handler đăng ký với payments cho purpose "order" (SPEC-orders.md mục 4).
export async function onOrderPaid(tx: Tx, intent: PaidIntent): Promise<AfterCommit> {
  const checkout = await tx.checkout.findUniqueOrThrow({ where: { id: intent.refId } });
  const orders = await tx.order.findMany({
    where: { checkoutId: checkout.id },
    include: { items: true },
    orderBy: { code: 'asc' },
  });
  const system = { id: null, role: 'system' as const };
  const paid: string[] = [];
  const refund: string[] = [];
  for (const order of orders) {
    if (order.status === 'pending_payment') {
      await applyAction(tx, order.id, 'pay', system);
      paid.push(order.id);
    } else if (order.status === 'cancelled') {
      // Trả muộn sau khi đơn tự huỷ: giữ hàng lại nếu còn, không thì chờ hoàn tiền.
      const reserved = await tryDecrementStock(
        tx,
        order.items.map((i) => ({ productId: i.productId, qty: i.qty })),
      );
      if (reserved) {
        await applyAction(tx, order.id, 'late_pay', system, {
          reason: 'Thanh toán sau khi đơn đã huỷ, còn hàng',
        });
        paid.push(order.id);
      } else {
        await applyAction(tx, order.id, 'late_pay_no_stock', system, {
          reason: 'Thanh toán sau khi đơn đã huỷ, hết hàng',
        });
        refund.push(order.id);
      }
    }
  }
  await tx.checkout.update({ where: { id: checkout.id }, data: { status: 'paid' } });
  return () => notifyPaid(checkout.buyerId, paid, refund);
}

async function notifyPaid(buyerId: string, paidIds: string[], refundIds: string[]): Promise<void> {
  const orders = await db.order.findMany({
    where: { id: { in: [...paidIds, ...refundIds] } },
    include: { items: true },
  });
  const buyer = await db.user.findUniqueOrThrow({ where: { id: buyerId } });
  const kiots = await db.kiot.findMany({
    where: { id: { in: orders.map((o) => o.kiotId) } },
    include: { owner: true },
  });
  const appUrl = env().APP_URL;

  if (buyer.email) {
    const paid = orders.filter((o) => paidIds.includes(o.id));
    const refund = orders.filter((o) => refundIds.includes(o.id));
    await sendMail({
      to: buyer.email,
      subject: `9MUA đã nhận thanh toán đơn ${orders.map((o) => o.code).join(', ')}`,
      ...renderEmail({
        title: 'Đã nhận thanh toán',
        greeting: `Chào ${buyer.displayName},`,
        paragraphs: [
          ...paid.map((o) => `${o.code}: ${formatVnd(o.total)} — người bán sẽ xác nhận trong 48 giờ.`),
          ...refund.map(
            (o) =>
              `${o.code}: sản phẩm đã hết hàng khi bạn thanh toán muộn. 9MUA sẽ hoàn lại ${formatVnd(o.total)}; hãy nhập tài khoản nhận hoàn tiền.`,
          ),
        ],
        action: { label: 'Xem đơn mua', url: `${appUrl}/don-mua` },
      }),
    });
  }
  for (const order of orders.filter((o) => paidIds.includes(o.id))) {
    const kiot = kiots.find((k) => k.id === order.kiotId);
    if (!kiot?.owner.email) continue;
    await sendMail({
      to: kiot.owner.email,
      subject: `Bạn có đơn mới ${order.code} — ${formatVnd(order.total)}`,
      ...renderEmail({
        title: 'Bạn có đơn hàng mới',
        greeting: `Chào ${kiot.owner.displayName},`,
        paragraphs: [
          `Đơn ${order.code} tại ${kiot.name} đã được thanh toán qua 9MUA: ${order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}.`,
          'Hãy xác nhận trong 48 giờ, nếu không đơn sẽ tự huỷ và hoàn tiền cho người mua.',
        ],
        action: { label: 'Xử lý đơn', url: `${appUrl}/kiot-cua-toi/don-hang` },
      }),
    });
  }
}

export async function cancelCheckout(
  userId: string,
  checkoutId: string,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'NOT_CANCELLABLE' }> {
  const checkout = await db.checkout.findUnique({ where: { id: checkoutId }, include: { orders: true } });
  if (!checkout || checkout.buyerId !== userId) return { ok: false, error: 'NOT_FOUND' };
  if (checkout.status !== 'pending') return { ok: false, error: 'NOT_CANCELLABLE' };
  try {
    await db.$transaction(async (tx) => {
      for (const o of checkout.orders)
        await applyAction(
          tx,
          o.id,
          'cancel',
          { id: userId, role: 'buyer' },
          { reason: 'Người mua huỷ trước khi thanh toán' },
        );
      await tx.checkout.update({ where: { id: checkoutId }, data: { status: 'cancelled' } });
    });
  } catch {
    return { ok: false, error: 'NOT_CANCELLABLE' };
  }
  if (checkout.intentId) await cancelPayment(checkout.intentId, 'Người mua huỷ đơn');
  return { ok: true };
}

// Tác vụ định kỳ: huỷ đơn quá 15 phút chưa trả, trả hàng về kho. Idempotent.
export async function expireUnpaidOrders(): Promise<{ expired: number }> {
  const cutoff = new Date(now().getTime() - PAYMENT_TTL_MINUTES * 60_000);
  const stale = await db.order.findMany({
    where: { status: 'pending_payment', createdAt: { lt: cutoff } },
    select: { id: true, checkoutId: true },
  });
  let expired = 0;
  for (const o of stale) {
    try {
      await db.$transaction(async (tx) => {
        await applyAction(
          tx,
          o.id,
          'expire',
          { id: null, role: 'system' },
          { reason: 'Quá 15 phút chưa thanh toán' },
        );
        await tx.checkout.updateMany({
          where: { id: o.checkoutId, status: 'pending' },
          data: { status: 'cancelled' },
        });
      });
      expired += 1;
    } catch {
      // Đơn vừa được thanh toán/huỷ ở luồng khác: bỏ qua.
    }
  }
  return { expired };
}

export async function getCheckoutForBuyer(userId: string, checkoutId: string) {
  const checkout = await db.checkout.findUnique({
    where: { id: checkoutId },
    include: { orders: { include: { items: true }, orderBy: { code: 'asc' } } },
  });
  return checkout && checkout.buyerId === userId ? checkout : null;
}

export function getSavedAddress(userId: string) {
  return db.buyerAddress.findUnique({ where: { userId } });
}
