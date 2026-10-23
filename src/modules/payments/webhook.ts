import { applyTransaction } from './apply';
import { gateway } from './gateway';

export type WebhookResult = { status: 200 | 400 | 500; body: { ok: boolean; message?: string } };

// POST /api/payos/webhook. Kiểm chữ ký TRƯỚC khi đọc bất kỳ trường nào.
export async function handleWebhook(body: unknown): Promise<WebhookResult> {
  let data;
  try {
    data = await gateway().verifyWebhook(body);
  } catch {
    console.warn('[payos] Webhook sai chữ ký hoặc sai định dạng — bỏ qua');
    return { status: 400, body: { ok: false, message: 'invalid signature' } };
  }
  if (data.code !== '00') return { status: 200, body: { ok: true, message: 'ignored' } };

  try {
    await applyTransaction(
      data.orderCode,
      {
        reference: data.reference,
        amount: data.amount,
        accountNumber: data.accountNumber,
        description: data.description,
        transactionDateTime: data.transactionDateTime,
        counterAccountName: data.counterAccountName ?? null,
        counterAccountNumber: data.counterAccountNumber ?? null,
        counterAccountBankName: data.counterAccountBankName ?? null,
      },
      'webhook',
      data,
    );
    return { status: 200, body: { ok: true } };
  } catch (error) {
    console.error('[payos] Lỗi xử lý webhook, PayOS sẽ gửi lại:', error);
    return { status: 500, body: { ok: false } };
  }
}
