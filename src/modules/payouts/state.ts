import { randomUUID } from 'node:crypto';
import type { PayoutRequest, Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { findBank } from '@/modules/kiot';

// Đổi trạng thái có điều kiện: chỉ một luồng thắng khi nhiều thao tác cùng nhắm vào một yêu cầu.
export async function moveFrom(
  tx: Tx,
  payoutId: string,
  from: 'pending' | 'processing',
  data: Prisma.PayoutRequestUncheckedUpdateManyInput,
): Promise<PayoutRequest | null> {
  const moved = await tx.payoutRequest.updateMany({ where: { id: payoutId, status: from }, data });
  return moved.count === 1 ? tx.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } }) : null;
}

// Trả số dư cho yêu cầu không chi (huỷ, từ chối, PayOS báo lỗi). Khoá duy nhất (type, refId) chặn hoàn 2 lần.
export async function reversePayout(tx: Tx, payout: PayoutRequest, note: string, actorId: string | null) {
  await tx.$executeRaw`
    INSERT INTO "BalanceEntry" (id, "kiotId", type, amount, "refId", note, "actorId", "createdAt")
    VALUES (${randomUUID()}, ${payout.kiotId}, 'payout_reversal', ${payout.amount}, ${payout.id}, ${note},
      ${actorId}, ${now()})
    ON CONFLICT (type, "refId") DO NOTHING`;
}

export async function notifySeller(
  payoutId: string,
  build: (p: PayoutRequest) => { subject: string; lines: string[] },
): Promise<void> {
  try {
    const payout = await db.payoutRequest.findUniqueOrThrow({ where: { id: payoutId } });
    const seller = await db.user.findUniqueOrThrow({ where: { id: payout.requestedById } });
    if (!seller.email) return;
    const { subject, lines } = build(payout);
    await sendMail({
      to: seller.email,
      subject,
      ...renderEmail({
        title: subject,
        greeting: `Chào ${seller.displayName},`,
        paragraphs: lines,
        action: { label: 'Xem số dư', url: `${env().APP_URL}/kiot-cua-toi/so-du` },
      }),
    });
  } catch (e) {
    // Thông báo hỏng không được làm hỏng thao tác tiền đã commit.
    console.error('[payouts] gửi email lỗi:', e);
  }
}

export function notifyPaid(payoutId: string): Promise<void> {
  return notifySeller(payoutId, (p) => ({
    subject: `Đã chuyển ${formatVnd(p.netAmount)} cho yêu cầu rút ${p.code}`,
    lines: [
      `9MUA đã chuyển ${formatVnd(p.netAmount)} vào tài khoản ${findBank(p.bankBin)?.shortName ?? p.bankBin} ${p.accountNumber}.`,
      p.fee > 0 ? `Phí chi hộ ${formatVnd(p.fee)} đã trừ vào số tiền rút ${formatVnd(p.amount)}.` : '',
      p.bankRef ? `Mã giao dịch: ${p.bankRef}.` : '',
    ].filter(Boolean),
  }));
}
