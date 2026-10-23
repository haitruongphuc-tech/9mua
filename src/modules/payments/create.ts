import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { normalizeDescription } from './description';
import { gateway } from './gateway';
import { reconcileIntent } from './reconcile';
import type { PaymentIntentView, Purpose } from './types';
import { toView } from './view';

const RECHECK_AFTER_MS = 10_000; // trang QR hỏi mỗi 3 giây nhưng chỉ gọi PayOS tối đa mỗi 10 giây

export async function createPayment(input: {
  purpose: Purpose;
  refId: string;
  amount: number;
  description: string;
  returnPath: string;
  ttlMinutes?: number;
}): Promise<PaymentIntentView> {
  if (!Number.isInteger(input.amount) || input.amount < 2000)
    throw new Error('Số tiền thanh toán phải là số nguyên ≥ 2.000đ');
  const description = normalizeDescription(input.description);
  const current = now();

  // Khoá theo (mục đích, mã tham chiếu) để bấm "Thanh toán" 2 lần cùng lúc không sinh 2 QR.
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.purpose}:${input.refId}`}))`;
      const existing = await tx.paymentIntent.findFirst({
        where: {
          purpose: input.purpose,
          refId: input.refId,
          amount: input.amount,
          status: 'pending',
          expiresAt: { gt: current },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return toView(existing);

      const seq = await tx.$queryRaw<{ code: bigint }[]>`SELECT nextval('payment_order_code_seq') AS code`;
      const code = seq[0]!.code;
      const expiresAt = new Date(current.getTime() + (input.ttlMinutes ?? 15) * 60_000);
      const returnUrl = `${env().APP_URL}${input.returnPath}`;
      const link = await gateway().createLink({
        orderCode: Number(code),
        amount: input.amount,
        description,
        returnUrl,
        cancelUrl: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}huy-thanh-toan=1`,
        expiredAt: Math.floor(expiresAt.getTime() / 1000),
      });
      const intent = await tx.paymentIntent.create({
        data: {
          orderCode: code,
          purpose: input.purpose,
          refId: input.refId,
          amount: input.amount,
          description,
          expiresAt,
          createdAt: current,
          ...link,
        },
      });
      return toView(intent);
    },
    { timeout: 20_000 },
  );
}

// Trang QR gọi để biết đã trả chưa; reconcile = hỏi lại PayOS nếu còn chờ (phòng webhook chậm/mất).
export async function getPayment(
  intentId: string,
  options: { reconcile?: boolean } = {},
): Promise<PaymentIntentView | null> {
  let intent = await db.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) return null;
  const stale = !intent.lastCheckedAt || now().getTime() - intent.lastCheckedAt.getTime() > RECHECK_AFTER_MS;
  if (options.reconcile && intent.status === 'pending' && stale) {
    await reconcileIntent(intent).catch((e) => console.error('[payos] Kiểm trạng thái lỗi:', e));
    intent = await db.paymentIntent.findUniqueOrThrow({ where: { id: intentId } });
  }
  return toView(intent);
}

export async function cancelPayment(intentId: string, reason: string): Promise<void> {
  const intent = await db.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent || intent.status !== 'pending') return;
  await gateway()
    .cancel(Number(intent.orderCode), reason)
    .catch((e) => console.warn('[payos] Huỷ link lỗi (có thể đã hết hạn):', e));
  await db.paymentIntent.updateMany({
    where: { id: intentId, status: 'pending' },
    data: { status: 'cancelled' },
  });
}

export type PaymentIssue = {
  key: string; // intent:<id> | event:<id> — dùng để đánh dấu đã xử lý
  kind: 'mismatch' | 'orphan' | 'duplicate_payment';
  intentId: string | null;
  orderCode: number;
  expected: number | null;
  received: number;
  at: Date;
  reference: string | null;
  counterAccount: string | null; // người chuyển: tên · STK · ngân hàng
};

// Cho admin: tiền vào lệch số, tiền vào không khớp đơn nào, hoặc trả 2 lần — chưa được CEO đánh dấu xử lý.
export async function listMismatches(): Promise<PaymentIssue[]> {
  const [intents, events, resolved] = await Promise.all([
    db.paymentIntent.findMany({ where: { status: 'mismatch' }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    db.paymentEvent.findMany({
      where: { outcome: { in: ['orphan', 'duplicate_payment'] } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.paymentIssueResolution.findMany({ select: { issueKey: true } }),
  ]);
  const done = new Set(resolved.map((r) => r.issueKey));
  const codes = [...intents.map((i) => i.orderCode), ...events.map((e) => e.orderCode)];
  const [byCodeIntents, intentEvents] = await Promise.all([
    db.paymentIntent.findMany({ where: { orderCode: { in: events.map((e) => e.orderCode) } } }),
    db.paymentEvent.findMany({ where: { orderCode: { in: codes } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const byCode = new Map(byCodeIntents.map((i) => [i.orderCode, i]));
  const lastEvent = new Map<bigint, (typeof intentEvents)[number]>();
  for (const e of intentEvents) if (!lastEvent.has(e.orderCode)) lastEvent.set(e.orderCode, e);
  const who = (e?: {
    counterAccountName: string | null;
    counterAccountNumber: string | null;
    counterAccountBankName: string | null;
  }) =>
    e
      ? [e.counterAccountName, e.counterAccountNumber, e.counterAccountBankName]
          .filter(Boolean)
          .join(' · ') || null
      : null;
  return [
    ...intents.map((i) => ({
      key: `intent:${i.id}`,
      kind: 'mismatch' as const,
      intentId: i.id,
      orderCode: Number(i.orderCode),
      expected: i.amount,
      received: i.amountPaid ?? 0,
      at: i.updatedAt,
      reference: lastEvent.get(i.orderCode)?.reference ?? null,
      counterAccount: who(lastEvent.get(i.orderCode)),
    })),
    ...events.map((e) => ({
      key: `event:${e.id}`,
      kind: e.outcome as 'orphan' | 'duplicate_payment',
      intentId: byCode.get(e.orderCode)?.id ?? null,
      orderCode: Number(e.orderCode),
      expected: byCode.get(e.orderCode)?.amount ?? null,
      received: e.amount,
      at: e.createdAt,
      reference: e.reference,
      counterAccount: who(e),
    })),
  ].filter((issue) => !done.has(issue.key));
}

// CEO ghi cách đã xử lý (vd. "Đã hoàn 50.000đ cho khách qua MB, mã FT…") và đánh dấu xong.
export async function resolvePaymentIssue(
  issueKey: string,
  adminId: string,
  note: string,
): Promise<{ ok: true } | { ok: false; error: 'NOTE_REQUIRED' | 'NOT_FOUND' }> {
  const text = note.trim();
  if (text.length < 5) return { ok: false, error: 'NOTE_REQUIRED' };
  const [kind, id] = issueKey.split(':');
  const exists =
    kind === 'intent'
      ? await db.paymentIntent.count({ where: { id, status: 'mismatch' } })
      : kind === 'event'
        ? await db.paymentEvent.count({ where: { id, outcome: { in: ['orphan', 'duplicate_payment'] } } })
        : 0;
  if (!exists) return { ok: false, error: 'NOT_FOUND' };
  await db.paymentIssueResolution.upsert({
    where: { issueKey },
    create: { issueKey, note: text.slice(0, 1000), resolvedById: adminId, resolvedAt: now() },
    update: {},
  });
  return { ok: true };
}
