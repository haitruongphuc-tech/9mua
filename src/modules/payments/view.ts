import type { PaymentIntent } from '@prisma/client';
import type { PaymentIntentView, Purpose } from './types';

export function toView(i: PaymentIntent): PaymentIntentView {
  return {
    intentId: i.id,
    orderCode: Number(i.orderCode),
    purpose: i.purpose as Purpose,
    refId: i.refId,
    amount: i.amount,
    description: i.description,
    status: i.status,
    checkoutUrl: i.checkoutUrl,
    qrCode: i.qrCode,
    expiresAt: i.expiresAt,
    paidAt: i.paidAt,
    amountPaid: i.amountPaid,
  };
}
