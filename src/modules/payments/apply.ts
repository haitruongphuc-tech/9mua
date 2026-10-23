import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import type { GatewayTransaction } from './gateway';
import { getPaymentHandler } from './registry';
import type { Purpose } from './types';

export type ApplyOutcome = 'applied' | 'partial' | 'mismatch' | 'duplicate_payment' | 'orphan' | 'duplicate';

type IntentRow = {
  id: string;
  status: string;
  amount: number;
  amountPaid: number | null;
  purpose: string;
  refId: string;
};

// Ghi nhận MỘT giao dịch tiền vào (từ webhook hoặc đối soát) — idempotent theo (orderCode, reference).
// Mọi thứ trong một transaction: khoá intent, ghi sổ, đổi trạng thái, gọi handler nghiệp vụ.
// Handler ném lỗi → rollback toàn bộ, kể cả dòng sổ cái, để lần gửi lại xử lý lại từ đầu.
export async function applyTransaction(
  orderCode: number,
  t: GatewayTransaction,
  source: 'webhook' | 'reconcile',
  payload: unknown,
): Promise<ApplyOutcome> {
  let afterCommit: (() => Promise<void>) | undefined;
  const outcome = await db.$transaction(
    async (tx) => {
      const [intent] = await tx.$queryRaw<IntentRow[]>`
        SELECT id, status::text AS status, amount, "amountPaid", purpose, "refId"
        FROM "PaymentIntent" WHERE "orderCode" = ${BigInt(orderCode)} FOR UPDATE`;

      let outcome: Exclude<ApplyOutcome, 'duplicate'>;
      let total = 0;
      if (!intent) outcome = 'orphan';
      else if (intent.status === 'paid') outcome = 'duplicate_payment';
      else {
        total = (intent.amountPaid ?? 0) + t.amount;
        outcome = total === intent.amount ? 'applied' : total < intent.amount ? 'partial' : 'mismatch';
      }

      const inserted = await tx.$executeRaw`
        INSERT INTO "PaymentEvent" (id, "orderCode", reference, amount, outcome, source, "transactionDateTime",
          "counterAccountName", "counterAccountNumber", "counterAccountBankName", payload, "createdAt")
        VALUES (${crypto.randomUUID()}, ${BigInt(orderCode)}, ${t.reference}, ${t.amount}, ${outcome}, ${source},
          ${t.transactionDateTime}, ${t.counterAccountName}, ${t.counterAccountNumber}, ${t.counterAccountBankName},
          ${JSON.stringify(payload ?? null)}::jsonb, ${now()})
        ON CONFLICT ("orderCode", reference) DO NOTHING`;
      if (inserted === 0) return 'duplicate';
      if (!intent || outcome === 'duplicate_payment') return outcome;

      if (outcome !== 'applied') {
        // Thiếu hoặc thừa tiền: không kích hoạt gì, CEO xử lý tay (SPEC-payments.md mục 2).
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: 'mismatch', amountPaid: total },
        });
        return outcome;
      }

      const handler = getPaymentHandler(intent.purpose as Purpose);
      if (!handler) throw new Error(`Chưa đăng ký handler cho thanh toán "${intent.purpose}"`);
      const paidAt = now();
      const updated = await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'paid', amountPaid: total, paidAt },
      });
      const after = await handler(tx, {
        intentId: updated.id,
        orderCode,
        purpose: updated.purpose as Purpose,
        refId: updated.refId,
        amount: updated.amount,
        paidAt,
      });
      if (typeof after === 'function') afterCommit = after;
      return 'applied';
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
  );
  // Chỉ chạy khi transaction đã commit; lỗi ở đây (vd. gửi mail) không làm mất giao dịch đã ghi nhận.
  if (afterCommit) await afterCommit().catch((e) => console.error('[payments] afterCommit lỗi:', e));
  return outcome;
}
