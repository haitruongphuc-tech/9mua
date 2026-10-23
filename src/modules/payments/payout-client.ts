import { APIError, ConnectionError, PayOS, type Payout } from '@payos/node';
import { randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

// Client chi hộ (SPEC-payouts.md mục 5). Cùng với gateway.ts là chỗ duy nhất nói chuyện với PayOS.

export type PayoutState =
  'RECEIVED' | 'PROCESSING' | 'CANCELLED' | 'SUCCEEDED' | 'ON_HOLD' | 'REVERSED' | 'FAILED';

export type PayoutInfo = {
  id: string;
  referenceId: string;
  state: PayoutState;
  bankRef: string | null;
  toAccountName: string | null;
  error: string | null;
};

export type PayoutCreateInput = {
  referenceId: string;
  amount: number;
  description: string;
  toBin: string;
  toAccountNumber: string;
};

export interface PayoutClient {
  // idempotencyKey cố định theo yêu cầu rút: gọi lại bao nhiêu lần PayOS cũng chỉ tạo 1 lệnh chi.
  create(input: PayoutCreateInput, idempotencyKey: string): Promise<PayoutInfo>;
  get(payosPayoutId: string): Promise<PayoutInfo>;
  findByReference(referenceId: string): Promise<PayoutInfo | null>;
  balance(): Promise<number>;
}

// PayOS trả lời rõ ràng là không nhận lệnh (sai tài khoản, quỹ không đủ, sai khoá…): chắc chắn chưa chi.
export class PayoutRejectedError extends Error {}
// Mất kết nối, hết thời gian chờ, PayOS lỗi 5xx, chữ ký phản hồi sai: KHÔNG biết lệnh đã tạo hay chưa.
export class PayoutUnknownError extends Error {}

const FINAL_REJECT_STATUSES = new Set([200, 400, 401, 403, 404, 422]);

export function classifyPayoutError(e: unknown): Error {
  if (e instanceof ConnectionError) return new PayoutUnknownError(e.message || 'Mất kết nối PayOS');
  if (e instanceof APIError && e.status !== undefined && FINAL_REJECT_STATUSES.has(e.status))
    return new PayoutRejectedError(e.desc || e.message);
  return new PayoutUnknownError(e instanceof Error ? e.message : String(e));
}

const IN_FLIGHT_APPROVAL = new Set(['DRAFTING', 'SUBMITTED', 'APPROVED', 'SCHEDULED', 'PROCESSING']);

// Chỉ tin trạng thái của giao dịch; chưa có giao dịch thì coi như đang xử lý (không bao giờ đoán là thành công).
export function payoutInfoFrom(p: Payout): PayoutInfo {
  const t = p.transactions[0];
  let state: PayoutState = t?.state ?? 'PROCESSING';
  if (!t && !IN_FLIGHT_APPROVAL.has(p.approvalState))
    state =
      p.approvalState === 'FAILED' ? 'FAILED' : p.approvalState === 'COMPLETED' ? 'PROCESSING' : 'CANCELLED';
  return {
    id: p.id,
    referenceId: p.referenceId,
    state,
    bankRef: t?.reference ?? null,
    toAccountName: t?.toAccountName ?? null,
    error: t?.errorMessage ?? null,
  };
}

class PayOSPayoutClient implements PayoutClient {
  private client: PayOS;

  constructor(e: ReturnType<typeof env>) {
    this.client = new PayOS({
      clientId: e.PAYOS_PAYOUT_CLIENT_ID!,
      apiKey: e.PAYOS_PAYOUT_API_KEY!,
      checksumKey: e.PAYOS_PAYOUT_CHECKSUM_KEY!,
      logLevel: 'off',
      // Người bán đang chờ trang phản hồi: lỗi thì để cron đồng bộ gửi lại, không chờ lâu ở đây.
      timeout: 15_000,
      maxRetries: 1, // SDK tự gửi lại với cùng header x-idempotency-key
    });
  }

  async create(input: PayoutCreateInput, idempotencyKey: string) {
    try {
      return payoutInfoFrom(await this.client.payouts.create(input, idempotencyKey));
    } catch (e) {
      throw classifyPayoutError(e);
    }
  }

  async get(id: string) {
    return payoutInfoFrom(await this.client.payouts.get(id));
  }

  async findByReference(referenceId: string) {
    const page = await this.client.payouts.list({ referenceId, limit: 5 });
    const found = page.data.find((p) => p.referenceId === referenceId);
    return found ? payoutInfoFrom(found) : null;
  }

  async balance() {
    const info = await this.client.payoutsAccount.balance();
    return Math.floor(Number(info.balance));
  }
}

type FakeRecord = { info: PayoutInfo; input: PayoutCreateInput; key: string };

// PayOS chi hộ giả cho dev/test/E2E, giữ trong bộ nhớ của tiến trình. Điều khiển được để thử các tình huống xấu.
export class FakePayoutClient implements PayoutClient {
  records = new Map<string, FakeRecord>();
  fund = 1_000_000_000;
  // Kết quả PayOS trả ở lần hỏi trạng thái kế tiếp.
  outcome: PayoutState = 'SUCCEEDED';
  // 'lost-response': PayOS đã tạo lệnh nhưng phản hồi bị mất (hết thời gian chờ).
  nextCreate: 'ok' | 'lost-response' | 'down' | { reject: string } = 'ok';
  failBalance = false;

  async create(input: PayoutCreateInput, key: string) {
    const existing = [...this.records.values()].find((r) => r.key === key);
    if (existing) return { ...existing.info };
    const mode = this.nextCreate;
    this.nextCreate = 'ok';
    if (mode === 'down') throw new PayoutUnknownError('PayOS giả không phản hồi');
    if (typeof mode === 'object') throw new PayoutRejectedError(mode.reject);
    const info: PayoutInfo = {
      id: `fpo_${randomBytes(6).toString('hex')}`,
      referenceId: input.referenceId,
      state: 'PROCESSING',
      bankRef: null,
      toAccountName: null,
      error: null,
    };
    this.records.set(info.id, { info, input, key });
    this.fund -= input.amount;
    if (mode === 'lost-response') throw new PayoutUnknownError('Hết thời gian chờ PayOS giả');
    return { ...info };
  }

  async get(id: string) {
    const r = this.records.get(id);
    if (!r) throw new Error(`Không có lệnh chi ${id}`);
    if (r.info.state === 'PROCESSING') {
      r.info.state = this.outcome;
      if (this.outcome === 'SUCCEEDED') {
        r.info.bankRef = `FT${randomBytes(5).toString('hex').toUpperCase()}`;
        r.info.toAccountName = 'NGUOI NHAN THAT';
      }
      if (this.outcome === 'FAILED') {
        r.info.error = 'Tài khoản nhận không tồn tại';
        this.fund += r.input.amount;
      }
    }
    return { ...r.info };
  }

  async findByReference(referenceId: string) {
    const r = [...this.records.values()].find((x) => x.info.referenceId === referenceId);
    return r ? { ...r.info } : null;
  }

  async balance() {
    if (this.failBalance) throw new PayoutUnknownError('PayOS giả không trả số dư');
    return this.fund;
  }

  reset() {
    this.records.clear();
    this.fund = 1_000_000_000;
    this.outcome = 'SUCCEEDED';
    this.nextCreate = 'ok';
    this.failBalance = false;
  }
}

const g = globalThis as unknown as { __fakePayoutClient?: FakePayoutClient };

export function fakePayoutClient(): FakePayoutClient {
  g.__fakePayoutClient ??= new FakePayoutClient();
  return g.__fakePayoutClient;
}

let real: PayOSPayoutClient | undefined;

// null = chưa có kênh chi hộ → hệ thống chạy chế độ duyệt tay.
export function payoutClient(): PayoutClient | null {
  const e = env();
  if (e.PAYMENTS_DRIVER === 'fake') return fakePayoutClient();
  if (!e.PAYOS_PAYOUT_CLIENT_ID || !e.PAYOS_PAYOUT_API_KEY || !e.PAYOS_PAYOUT_CHECKSUM_KEY) return null;
  real ??= new PayOSPayoutClient(e);
  return real;
}
