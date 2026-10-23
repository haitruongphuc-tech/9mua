import { now } from './clock';
import { db } from './db';
import { env } from './env';
import { formatDateTimeVN } from './format';
import { sendMail } from './mail';
import { renderEmail } from './mail/templates';

// Báo CEO qua email (SPEC-admin.md mục 6). Mỗi loại tối đa 1 email / 15 phút; sự việc đến trong lúc chờ
// được gộp vào email kế tiếp (gửi khi có sự việc mới sau 15 phút, hoặc khi cron gọi flushAlerts).
export const ALERT_WINDOW_MINUTES = 15;

export const ALERT_LABELS: Record<string, string> = {
  payout_failed: 'Lệnh chi PayOS lỗi',
  payout_rejected: 'PayOS từ chối lệnh chi',
  payout_stuck: 'Lệnh chi PayOS bị treo',
  payout_fund_low: 'Quỹ chi PayOS sắp hết',
};

// Không bao giờ ném lỗi: cảnh báo hỏng không được làm hỏng luồng tiền đang chạy.
export async function alertCeo(kind: string, message: string): Promise<void> {
  try {
    await db.alertEvent.create({ data: { kind, message: message.slice(0, 1000), createdAt: now() } });
    await flushAlerts(kind);
  } catch (e) {
    console.error(`[alerts] không gửi được cảnh báo ${kind}:`, e);
  }
}

export async function flushAlerts(onlyKind?: string): Promise<number> {
  const kinds = onlyKind
    ? [onlyKind]
    : (
        await db.alertEvent.findMany({ where: { sentAt: null }, distinct: ['kind'], select: { kind: true } })
      ).map((r) => r.kind);
  let sent = 0;
  for (const kind of kinds) if (await flushKind(kind)) sent += 1;
  return sent;
}

async function flushKind(kind: string): Promise<boolean> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`alert:${kind}`}))`;
      const at = now();
      const throttle = await tx.alertThrottle.findUnique({ where: { kind } });
      if (throttle && at.getTime() - throttle.lastSentAt.getTime() < ALERT_WINDOW_MINUTES * 60_000)
        return false;
      const events = await tx.alertEvent.findMany({
        where: { kind, sentAt: null },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      if (events.length === 0) return false;
      await tx.alertEvent.updateMany({
        where: { id: { in: events.map((e) => e.id) } },
        data: { sentAt: at },
      });
      await tx.alertThrottle.upsert({
        where: { kind },
        create: { kind, lastSentAt: at },
        update: { lastSentAt: at },
      });
      const recipients = await tx.user.findMany({
        where: { role: 'admin', lockedAt: null, email: { not: null } },
        select: { email: true },
      });
      const label = ALERT_LABELS[kind] ?? kind;
      const lines = events.map((e) => `${formatDateTimeVN(e.createdAt)} — ${e.message}`);
      if (recipients.length === 0) {
        console.error(`[alerts] chưa có admin nào có email; ${label}:\n${lines.join('\n')}`);
        return false;
      }
      // Gửi trong transaction: gửi lỗi thì rollback, sự việc vẫn chờ gửi ở lần sau.
      for (const r of recipients) {
        await sendMail({
          to: r.email!,
          subject: `[9MUA] ${label}${events.length > 1 ? ` (${events.length} việc)` : ''}`,
          ...renderEmail({
            title: label,
            greeting: 'Chào CEO,',
            paragraphs: lines,
            action: { label: 'Mở trang quản trị', url: `${env().APP_URL}/admin` },
          }),
        });
      }
      return true;
    },
    { timeout: 30_000 },
  );
}
