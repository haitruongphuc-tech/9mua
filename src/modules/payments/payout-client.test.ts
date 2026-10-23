import {
  APIError,
  ConnectionError,
  ConnectionTimeoutError,
  InvalidSignatureError,
  type Payout,
} from '@payos/node';
import { describe, expect, it } from 'vitest';
import {
  classifyPayoutError,
  FakePayoutClient,
  payoutInfoFrom,
  PayoutRejectedError,
  PayoutUnknownError,
} from './payout-client';

const base: Payout = {
  id: 'po_1',
  referenceId: 'RT100001',
  transactions: [],
  category: null,
  approvalState: 'SUBMITTED',
  createdAt: '2026-10-23T10:00:00+07:00',
};
const txn = (state: Payout['transactions'][number]['state']) => ({
  id: 't1',
  referenceId: 'RT100001',
  amount: 48_000,
  description: '9MUA RUT RT100001',
  toBin: '970422',
  toAccountNumber: '0979393916',
  toAccountName: 'NGUYEN HAI',
  reference: 'FT123',
  transactionDatetime: null,
  errorMessage: null,
  errorCode: null,
  state,
});

describe('đọc trạng thái lệnh chi PayOS', () => {
  it('trạng thái giao dịch là nguồn sự thật', () => {
    expect(
      payoutInfoFrom({ ...base, approvalState: 'COMPLETED', transactions: [txn('SUCCEEDED')] }),
    ).toMatchObject({
      state: 'SUCCEEDED',
      bankRef: 'FT123',
      toAccountName: 'NGUYEN HAI',
    });
    expect(payoutInfoFrom({ ...base, transactions: [txn('FAILED')] }).state).toBe('FAILED');
  });

  it('chưa có giao dịch thì không bao giờ coi là thành công', () => {
    expect(payoutInfoFrom(base).state).toBe('PROCESSING');
    expect(payoutInfoFrom({ ...base, approvalState: 'COMPLETED' }).state).toBe('PROCESSING');
    expect(payoutInfoFrom({ ...base, approvalState: 'REJECTED' }).state).toBe('CANCELLED');
    expect(payoutInfoFrom({ ...base, approvalState: 'FAILED' }).state).toBe('FAILED');
  });
});

describe('phân loại lỗi khi gửi lệnh chi', () => {
  it('PayOS trả lỗi rõ ràng → chắc chắn chưa chi', () => {
    const bad = APIError.generateError(
      400,
      { code: '214', desc: 'Số dư không đủ' },
      undefined,
      new Headers(),
    );
    expect(classifyPayoutError(bad)).toBeInstanceOf(PayoutRejectedError);
    expect(classifyPayoutError(bad).message).toBe('Số dư không đủ');
    // HTTP 200 nhưng code khác '00'
    const soft = APIError.generateError(
      200,
      { code: '20', desc: 'Sai tài khoản' },
      'Sai tài khoản',
      new Headers(),
    );
    expect(classifyPayoutError(soft)).toBeInstanceOf(PayoutRejectedError);
  });

  it('mất kết nối, hết thời gian chờ, 5xx, chữ ký phản hồi sai → không biết đã chi chưa', () => {
    for (const e of [
      new ConnectionError(),
      new ConnectionTimeoutError(),
      APIError.generateError(502, undefined, 'Bad gateway', new Headers()),
      new InvalidSignatureError('Data integrity check failed'),
    ])
      expect(classifyPayoutError(e)).toBeInstanceOf(PayoutUnknownError);
  });
});

describe('PayOS chi hộ giả', () => {
  const input = { referenceId: 'RT1', amount: 1000, description: 'x', toBin: '970422', toAccountNumber: '1' };

  it('cùng idempotencyKey thì chỉ 1 lệnh chi, kể cả khi lần đầu mất phản hồi', async () => {
    const fake = new FakePayoutClient();
    fake.nextCreate = 'lost-response';
    await expect(fake.create(input, 'k1')).rejects.toBeInstanceOf(PayoutUnknownError);
    const again = await fake.create(input, 'k1');
    expect(fake.records.size).toBe(1);
    expect((await fake.findByReference('RT1'))?.id).toBe(again.id);
  });
});
