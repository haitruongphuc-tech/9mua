'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { fakeGateway } from '@/modules/payments/gateway';
import { handleWebhook } from '@/server/payments';

// Giả lập tiền vào: webhook được ký đúng chuẩn rồi đi qua ĐÚNG hàm xử lý webhook thật.
export async function simulateAction(orderCode: number, form: FormData): Promise<void> {
  if (env().PAYMENTS_DRIVER !== 'fake') throw new Error('Chỉ dùng với PayOS giả');
  const intent = await db.paymentIntent.findUniqueOrThrow({ where: { orderCode: BigInt(orderCode) } });
  const mode = String(form.get('mode'));
  const amount = mode === 'short' ? intent.amount - 1000 : intent.amount;
  if (mode === 'lost') {
    await fakeGateway().markPaidWithoutWebhook({ orderCode, amount });
  } else {
    const body = await fakeGateway().buildPaidWebhook({ orderCode, amount, description: intent.description });
    await handleWebhook(body);
  }
  revalidatePath(`/dev/payos/${orderCode}`);
}
