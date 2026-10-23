import { db } from '@/lib/db';
import { findBank } from '@/modules/kiot';

// Xuất CSV cho kế toán (SPEC-admin.md mục 4): UTF-8 có BOM để Excel mở đúng tiếng Việt, xuống dòng CRLF,
// số tiền là số nguyên không dấu phân cách để Excel cộng được.
const BOM = '﻿';

export function csvCell(value: unknown): string {
  let s =
    value === null || value === undefined ? '' : value instanceof Date ? vnDateTime(value) : String(value);
  // Chặn chèn công thức khi mở bằng Excel (=, +, -, @ ở đầu ô văn bản).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function vnDateTime(d: Date): string {
  return new Date(d.getTime() + 7 * 3_600_000).toISOString().replace('T', ' ').slice(0, 19);
}

const OUTCOME: Record<string, string> = {
  applied: 'Đã ghi nhận',
  partial: 'Thiếu tiền',
  mismatch: 'Lệch tiền',
  duplicate_payment: 'Trả 2 lần',
  orphan: 'Không khớp đơn',
};

// Tiền vào: sổ PaymentEvent (mọi giao dịch PayOS báo về).
export async function incomingCsv(from: Date, to: Date): Promise<string> {
  const events = await db.paymentEvent.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: 'asc' },
    take: 50_000,
  });
  const intents = await db.paymentIntent.findMany({
    where: { orderCode: { in: events.map((e) => e.orderCode) } },
    select: { orderCode: true, purpose: true, description: true },
  });
  const byCode = new Map(intents.map((i) => [i.orderCode, i]));
  return toCsv(
    [
      'Thời gian',
      'Mã thanh toán',
      'Loại',
      'Nội dung',
      'Số tiền',
      'Kết quả',
      'Mã giao dịch',
      'Người chuyển',
      'STK chuyển',
      'Ngân hàng chuyển',
    ],
    events.map((e) => {
      const i = byCode.get(e.orderCode);
      return [
        e.createdAt,
        Number(e.orderCode),
        i?.purpose === 'kiot_fee' ? 'Phí thuê Kiot' : i?.purpose === 'order' ? 'Tiền đơn hàng' : 'Không rõ',
        i?.description ?? '',
        e.amount,
        OUTCOME[e.outcome] ?? e.outcome,
        e.reference,
        e.counterAccountName,
        e.counterAccountNumber,
        e.counterAccountBankName,
      ];
    }),
  );
}

// Tiền ra: chi cho người bán (yêu cầu rút đã chuyển) và hoàn cho người mua.
export async function outgoingCsv(from: Date, to: Date): Promise<string> {
  const [payouts, refunds] = await Promise.all([
    db.payoutRequest.findMany({
      where: { status: 'paid', paidAt: { gte: from, lt: to } },
      orderBy: { paidAt: 'asc' },
      take: 50_000,
    }),
    db.order.findMany({
      where: { status: 'refunded', refundedAt: { gte: from, lt: to } },
      orderBy: { refundedAt: 'asc' },
      take: 50_000,
    }),
  ]);
  const kiots = new Map(
    (
      await db.kiot.findMany({
        where: { id: { in: payouts.map((p) => p.kiotId) } },
        select: { id: true, name: true },
      })
    ).map((k) => [k.id, k.name]),
  );
  type Row = [Date, ...unknown[]];
  const rows: Row[] = [
    ...payouts.map((p): Row => [
      p.paidAt!,
      'Chi người bán',
      p.code,
      kiots.get(p.kiotId) ?? '',
      p.amount,
      p.fee,
      p.netAmount,
      findBank(p.bankBin)?.shortName ?? p.bankBin,
      p.accountNumber,
      p.accountName,
      p.mode === 'auto' ? 'Tự động' : 'Duyệt tay',
      p.bankRef,
    ]),
    ...refunds.map((o): Row => {
      const acc = o.refundAccount as {
        bankBin?: string;
        accountNumber?: string;
        accountName?: string;
      } | null;
      return [
        o.refundedAt!,
        'Hoàn người mua',
        o.code,
        '',
        o.total,
        0,
        o.total,
        acc?.bankBin ? (findBank(acc.bankBin)?.shortName ?? acc.bankBin) : '',
        acc?.accountNumber ?? '',
        acc?.accountName ?? '',
        'Duyệt tay',
        o.refundRef,
      ];
    }),
  ].sort((a, b) => a[0].getTime() - b[0].getTime());
  return toCsv(
    [
      'Thời gian',
      'Loại',
      'Mã',
      'Kiot',
      'Số tiền',
      'Phí chi hộ',
      'Số tiền chuyển',
      'Ngân hàng',
      'STK nhận',
      'Tên nhận',
      'Hình thức',
      'Mã giao dịch',
    ],
    rows,
  );
}
