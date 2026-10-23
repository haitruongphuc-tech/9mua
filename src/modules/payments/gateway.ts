import { PayOS, type Webhook, type WebhookData } from '@payos/node';
import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export type GatewayTransaction = {
  reference: string;
  amount: number;
  accountNumber: string;
  description: string;
  transactionDateTime: string;
  counterAccountName: string | null;
  counterAccountNumber: string | null;
  counterAccountBankName: string | null;
};

export type GatewayStatus = { status: string; amountPaid: number; transactions: GatewayTransaction[] };

// Chỗ duy nhất trong hệ thống nói chuyện với PayOS (SPEC-payments.md).
export interface PaymentGateway {
  createLink(input: {
    orderCode: number;
    amount: number;
    description: string;
    returnUrl: string;
    cancelUrl: string;
    expiredAt: number;
  }): Promise<{ paymentLinkId: string; checkoutUrl: string; qrCode: string }>;
  getStatus(orderCode: number): Promise<GatewayStatus>;
  cancel(orderCode: number, reason: string): Promise<void>;
  verifyWebhook(body: unknown): Promise<WebhookData>;
  confirmWebhook(url: string): Promise<void>;
}

function sdk(): PayOS {
  const e = env();
  return new PayOS({
    clientId: e.PAYOS_CLIENT_ID ?? 'fake-client',
    apiKey: e.PAYOS_API_KEY ?? 'fake-key',
    checksumKey: e.PAYOS_CHECKSUM_KEY,
    logLevel: 'off',
  });
}

// Kiểm chữ ký luôn dùng SDK chính thức, ở cả driver thật và giả.
async function verifyWithSdk(client: PayOS, body: unknown): Promise<WebhookData> {
  if (!body || typeof body !== 'object') throw new Error('Webhook không hợp lệ');
  return client.webhooks.verify(body as Webhook);
}

class PayOSGateway implements PaymentGateway {
  private client = sdk();

  async createLink(input: Parameters<PaymentGateway['createLink']>[0]) {
    const link = await this.client.paymentRequests.create(input);
    return { paymentLinkId: link.paymentLinkId, checkoutUrl: link.checkoutUrl, qrCode: link.qrCode };
  }

  async getStatus(orderCode: number): Promise<GatewayStatus> {
    const link = await this.client.paymentRequests.get(orderCode);
    return {
      status: link.status,
      amountPaid: link.amountPaid,
      transactions: link.transactions.map((t) => ({
        reference: t.reference,
        amount: t.amount,
        accountNumber: t.accountNumber,
        description: t.description,
        transactionDateTime: t.transactionDateTime,
        counterAccountName: t.counterAccountName,
        counterAccountNumber: t.counterAccountNumber,
        counterAccountBankName: t.counterAccountBankName,
      })),
    };
  }

  async cancel(orderCode: number, reason: string) {
    await this.client.paymentRequests.cancel(orderCode, reason);
  }

  verifyWebhook(body: unknown) {
    return verifyWithSdk(this.client, body);
  }

  async confirmWebhook(url: string) {
    await this.client.webhooks.confirm(url);
  }
}

const vnDateTime = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  const t = new Date(d.getTime() + 7 * 3_600_000); // giờ Việt Nam như PayOS
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`;
};

// PayOS giả cho dev/test/E2E: lưu link trong bảng FakePayosLink, ký webhook bằng chính SDK.
export class FakeGateway implements PaymentGateway {
  private client = sdk();

  async createLink(input: Parameters<PaymentGateway['createLink']>[0]) {
    await db.fakePayosLink.create({
      data: {
        orderCode: BigInt(input.orderCode),
        amount: input.amount,
        description: input.description,
        status: 'PENDING',
        expiresAt: new Date(input.expiredAt * 1000),
      },
    });
    return {
      paymentLinkId: `fake_${input.orderCode}`,
      checkoutUrl: `${env().APP_URL}/dev/payos/${input.orderCode}`,
      qrCode: `00020101021238570010A000000727FAKE9MUA${input.orderCode}5303704540${input.amount}5802VN6304FAKE`,
    };
  }

  async getStatus(orderCode: number): Promise<GatewayStatus> {
    const link = await db.fakePayosLink.findUniqueOrThrow({ where: { orderCode: BigInt(orderCode) } });
    const transactions = link.transactions as GatewayTransaction[];
    const amountPaid = transactions.reduce((s, t) => s + t.amount, 0);
    const status = link.status === 'PENDING' && link.expiresAt <= now() ? 'EXPIRED' : link.status;
    return { status, amountPaid, transactions };
  }

  async cancel(orderCode: number) {
    await db.fakePayosLink.updateMany({
      where: { orderCode: BigInt(orderCode), status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  verifyWebhook(body: unknown) {
    return verifyWithSdk(this.client, body);
  }

  async confirmWebhook() {}

  // Ghi nhận một giao dịch vào link giả và trả về webhook đã ký đúng chuẩn PayOS.
  private async recordTransaction(input: {
    orderCode: number;
    amount: number;
    description?: string;
  }): Promise<Webhook> {
    const link = await db.fakePayosLink.findUnique({ where: { orderCode: BigInt(input.orderCode) } });
    const tx: GatewayTransaction = {
      reference: `FT${randomBytes(6).toString('hex').toUpperCase()}`,
      amount: input.amount,
      accountNumber: '979393916',
      description: input.description ?? link?.description ?? '',
      transactionDateTime: vnDateTime(now()),
      counterAccountName: 'NGUYEN VAN KHACH',
      counterAccountNumber: '0123456789',
      counterAccountBankName: 'MB Bank',
    };
    if (link) {
      const transactions = [...(link.transactions as GatewayTransaction[]), tx];
      const paid = transactions.reduce((s, t) => s + t.amount, 0);
      await db.fakePayosLink.update({
        where: { orderCode: link.orderCode },
        data: { transactions, status: paid >= link.amount ? 'PAID' : 'UNDERPAID' },
      });
    }
    const data: WebhookData = {
      orderCode: input.orderCode,
      amount: input.amount,
      description: tx.description,
      accountNumber: tx.accountNumber,
      reference: tx.reference,
      transactionDateTime: tx.transactionDateTime,
      currency: 'VND',
      paymentLinkId: `fake_${input.orderCode}`,
      code: '00',
      desc: 'Thành công',
      counterAccountBankId: '970422',
      counterAccountBankName: tx.counterAccountBankName,
      counterAccountName: tx.counterAccountName,
      counterAccountNumber: tx.counterAccountNumber,
      virtualAccountName: '',
      virtualAccountNumber: '',
    };
    const signature = await this.client.crypto.createSignatureFromObj(data, env().PAYOS_CHECKSUM_KEY);
    return { code: '00', desc: 'success', success: true, data, signature: signature ?? '' };
  }

  buildPaidWebhook(input: { orderCode: number; amount: number; description?: string }): Promise<Webhook> {
    return this.recordTransaction(input);
  }

  // Giả lập trường hợp webhook bị mất: tiền đã vào PayOS nhưng hệ thống chưa nhận được thông báo.
  markPaidWithoutWebhook(input: { orderCode: number; amount: number }): Promise<Webhook> {
    return this.recordTransaction(input);
  }
}

let instance: PaymentGateway | undefined;

export function gateway(): PaymentGateway {
  instance ??= env().PAYMENTS_DRIVER === 'payos' ? new PayOSGateway() : new FakeGateway();
  return instance;
}

export function fakeGateway(): FakeGateway {
  const g = gateway();
  if (!(g instanceof FakeGateway)) throw new Error('Chỉ dùng được khi PAYMENTS_DRIVER=fake');
  return g;
}
