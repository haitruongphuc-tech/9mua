import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { formatDateVN } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { env } from '@/lib/env';

const DAY = 86_400_000;

// Khoảng thời gian còn lại (so với lúc cron chạy) ứng với từng mốc nhắc; các khoảng không chồng nhau.
const MILESTONES = [
  {
    id: 'd14',
    from: 3 * DAY,
    to: 14 * DAY,
    subject: (k: string) => `Kiot ${k} còn khoảng 14 ngày sẽ hết hạn`,
  },
  { id: 'd3', from: 1 * DAY, to: 3 * DAY, subject: (k: string) => `Kiot ${k} còn 3 ngày sẽ hết hạn` },
  { id: 'd0', from: -1 * DAY, to: 1 * DAY, subject: (k: string) => `Kiot ${k} hết hạn hôm nay` },
] as const;

// Cron 8:00 mỗi ngày (SPEC-billing.md mục 5). Ghi mốc trước rồi mới gửi để cron chạy chồng không gửi trùng.
export async function sendExpiryReminders(): Promise<{ sent: number }> {
  const at = now();
  let sent = 0;
  for (const m of MILESTONES) {
    const kiots = await db.kiot.findMany({
      where: {
        lockedAt: null,
        activeUntil: { gt: new Date(at.getTime() + m.from), lte: new Date(at.getTime() + m.to) },
      },
      include: { owner: true },
    });
    for (const kiot of kiots) {
      const periodEnd = kiot.activeUntil!;
      const claimed = await db.$executeRaw`
        INSERT INTO "BillingReminder" ("kiotId", milestone, "periodEnd", "sentAt")
        VALUES (${kiot.id}, ${m.id}, ${periodEnd}, ${at}) ON CONFLICT DO NOTHING`;
      if (claimed === 0 || !kiot.owner.email) continue;
      await sendMail({
        to: kiot.owner.email,
        subject: m.subject(kiot.name),
        ...renderEmail({
          title: 'Nhắc gia hạn Kiot',
          greeting: `Chào ${kiot.owner.displayName},`,
          paragraphs: [
            `Kiot ${kiot.name} hoạt động đến ${formatDateVN(periodEnd)}.`,
            'Khi hết hạn, trang Kiot tạm ngưng nhưng sản phẩm và dữ liệu vẫn giữ nguyên; gia hạn là mở lại ngay. Gia hạn sớm được cộng dồn, không mất ngày nào.',
          ],
          action: { label: 'Gia hạn ngay', url: `${env().APP_URL}/kiot-cua-toi` },
        }),
      });
      sent += 1;
    }
  }
  return { sent };
}

export type KiotExpiringView = {
  kiotId: string;
  slug: string;
  name: string;
  activeUntil: Date;
  ownerName: string;
};

export async function listExpiringKiots(withinDays: number): Promise<KiotExpiringView[]> {
  const at = now();
  const kiots = await db.kiot.findMany({
    where: { lockedAt: null, activeUntil: { gt: at, lte: new Date(at.getTime() + withinDays * DAY) } },
    include: { owner: { select: { displayName: true } } },
    orderBy: { activeUntil: 'asc' },
    take: 500,
  });
  return kiots.map((k) => ({
    kiotId: k.id,
    slug: k.slug,
    name: k.name,
    activeUntil: k.activeUntil!,
    ownerName: k.owner.displayName,
  }));
}

// Doanh thu phí thuê thật (không tính năm 9MUA tặng).
export async function revenueSummary(range: {
  from: Date;
  to: Date;
}): Promise<{ count: number; total: number }> {
  const r = await db.kiotSubscription.aggregate({
    where: { source: 'payos', createdAt: { gte: range.from, lt: range.to } },
    _count: true,
    _sum: { amount: true },
  });
  return { count: r._count, total: r._sum.amount ?? 0 };
}
