import { db } from '@/lib/db';
import { fakeGateway } from '@/modules/payments/gateway';
import { handleWebhook } from '@/modules/payments/webhook';

// Ký và gửi webhook giả lập đúng chuẩn PayOS cho một orderCode (trả đủ hoặc theo số tiền chỉ định).
export async function simulatePaid(orderCode: number, amount?: number) {
  const intent = await db.paymentIntent.findUniqueOrThrow({ where: { orderCode: BigInt(orderCode) } });
  const body = await fakeGateway().buildPaidWebhook({
    orderCode,
    amount: amount ?? intent.amount,
    description: intent.description,
  });
  return { body, result: await handleWebhook(body) };
}
