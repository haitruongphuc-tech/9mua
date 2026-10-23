import type { KiotSubscription } from '@prisma/client';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { formatDateVN, formatVnd } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { getIntSetting, setSetting } from '@/lib/settings';
import { extendActiveUntil } from '@/modules/kiot';
import { createPayment, type AfterCommit, type PaidIntent } from '@/modules/payments';
import { nextPeriod } from './period';

export async function getKiotFee(): Promise<number> {
  return getIntSetting('kiot_fee_vnd');
}

export async function setKiotFee(amount: number, adminId: string): Promise<void> {
  if (!Number.isInteger(amount) || amount < 2000 || amount > 10_000_000)
    throw new Error('Phí thuê Kiot phải từ 2.000đ');
  await setSetting('kiot_fee_vnd', String(amount), adminId);
}

export async function startKiotPayment(
  kiotId: string,
  userId: string,
): Promise<{ ok: true; intentId: string } | { ok: false; error: 'NOT_OWNER' | 'KIOT_LOCKED' }> {
  const kiot = await db.kiot.findUnique({ where: { id: kiotId } });
  if (!kiot || kiot.ownerId !== userId) return { ok: false, error: 'NOT_OWNER' };
  if (kiot.lockedAt) return { ok: false, error: 'KIOT_LOCKED' };
  const intent = await createPayment({
    purpose: 'kiot_fee',
    refId: kiot.id,
    amount: await getKiotFee(), // giá chụp vào intent lúc tạo; đổi giá sau không ảnh hưởng QR đang chờ
    description: `KIOT${kiot.id.slice(-5).toUpperCase()}`,
    returnPath: '/kiot-cua-toi/thanh-toan?tu-payos=1',
  });
  return { ok: true, intentId: intent.intentId };
}

async function extend(
  tx: Tx,
  kiotId: string,
  data: Omit<KiotSubscription, 'id' | 'kiotId' | 'periodStart' | 'periodEnd' | 'createdAt'>,
) {
  // Khoá dòng Kiot để hai lần gia hạn đồng thời không đọc cùng một activeUntil cũ.
  const [kiot] = await tx.$queryRaw<{ activeUntil: Date | null }[]>`
    SELECT "activeUntil" FROM "Kiot" WHERE id = ${kiotId} FOR UPDATE`;
  if (!kiot) throw new Error(`Không tìm thấy Kiot ${kiotId}`);
  const at = now();
  const period = nextPeriod(kiot.activeUntil, at);
  await tx.kiotSubscription.create({
    data: { ...data, kiotId, periodStart: period.start, periodEnd: period.end, createdAt: at },
  });
  await extendActiveUntil(tx, kiotId, period.end);
  return period;
}

// Handler đăng ký với payments: chạy trong transaction ghi nhận tiền (SPEC-billing.md mục 2).
export async function onKiotFeePaid(tx: Tx, intent: PaidIntent): Promise<AfterCommit> {
  const period = await extend(tx, intent.refId, {
    source: 'payos',
    intentId: intent.intentId,
    amount: intent.amount,
    grantedById: null,
    note: null,
  });
  const kiot = await tx.kiot.findUniqueOrThrow({ where: { id: intent.refId }, include: { owner: true } });
  return async () => {
    if (!kiot.owner.email) return;
    await sendMail({
      to: kiot.owner.email,
      subject: `Biên nhận phí thuê Kiot ${kiot.name}`,
      ...renderEmail({
        title: 'Biên nhận thanh toán',
        greeting: `Chào ${kiot.owner.displayName},`,
        paragraphs: [
          `9MUA đã nhận ${formatVnd(intent.amount)} phí thuê Kiot ${kiot.name}.`,
          `Kỳ hạn: ${formatDateVN(period.start)} – ${formatDateVN(period.end)}.`,
          `Mã giao dịch: ${intent.orderCode}.`,
        ],
        footnote: '9MUA CO.,LTD · MST 3401295437',
      }),
    });
  };
}

export async function grantYear(kiotId: string, adminId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error('Cần ghi lý do tặng năm');
  await db.$transaction((tx) =>
    extend(tx, kiotId, {
      source: 'admin_grant',
      intentId: null,
      amount: 0,
      grantedById: adminId,
      note: reason.trim(),
    }),
  );
}

export async function getKiotBilling(kiotId: string) {
  const [kiot, history] = await Promise.all([
    db.kiot.findUniqueOrThrow({ where: { id: kiotId }, select: { activeUntil: true } }),
    db.kiotSubscription.findMany({ where: { kiotId }, orderBy: { createdAt: 'desc' } }),
  ]);
  return { activeUntil: kiot.activeUntil, history };
}
