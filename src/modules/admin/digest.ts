import { Prisma } from '@prisma/client';
import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import { custodyReport } from '@/modules/payouts';
import { getTodo } from './metrics';

// Bản tin 8:00 mỗi sáng cho CEO (SPEC-admin.md mục 6): số liệu hôm qua (giờ VN) + việc cần xử lý.
export async function buildDigest() {
  const to = startOfVnDay();
  const from = new Date(to.getTime() - 86_400_000);
  const [newUsers, newKiots, paidOrders, kiotFees, newVideos, custody, todo] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.kiot.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.order.aggregate({ where: { paidAt: { gte: from, lt: to } }, _sum: { total: true }, _count: true }),
    db.kiotSubscription.aggregate({
      where: { source: 'payos', createdAt: { gte: from, lt: to } },
      _sum: { amount: true },
    }),
    db.video.count({ where: { createdAt: { gte: from, lt: to }, status: { not: 'deleted' } } }),
    custodyReport({ from, to }),
    getTodo(),
  ]);
  const day = new Date(from.getTime() + 7 * 3_600_000)
    .toISOString()
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/');
  return {
    day,
    lines: [
      `Người dùng mới: ${newUsers} · Kiot mới: ${newKiots} · Video mới: ${newVideos}`,
      `Đơn đã trả: ${paidOrders._count} đơn, ${formatVnd(paidOrders._sum.total ?? 0)}`,
      `Phí sàn: ${formatVnd(custody.platformFees)} · Phí thuê Kiot: ${formatVnd(kiotFees._sum.amount ?? 0)}`,
      `Đã chi cho người bán: ${formatVnd(custody.paidOut)} · Tiền đang giữ hộ: ${formatVnd(custody.held)}`,
    ],
    todo: todo.map((t) => `${t.label}: ${t.count}`),
  };
}

export async function sendDailyDigest(): Promise<{ sent: number }> {
  const digest = await buildDigest();
  const admins = await db.user.findMany({
    where: { role: 'admin', lockedAt: null, email: { not: null } },
    select: { email: true },
  });
  const subject = `[9MUA] Bản tin ngày ${digest.day}`;
  const paragraphs = [
    ...digest.lines,
    digest.todo.length ? `Việc cần xử lý: ${digest.todo.join(' · ')}.` : 'Không có việc nào đang chờ xử lý.',
  ];
  for (const a of admins)
    await sendMail({
      to: a.email!,
      subject,
      ...renderEmail({
        title: `Bản tin ngày ${digest.day}`,
        greeting: 'Chào CEO,',
        paragraphs,
        action: { label: 'Mở trang CEO', url: `${env().APP_URL}/admin` },
      }),
    });
  return { sent: admins.length };
}

// Nhắc người mua nhập tài khoản nhận hoàn tiền (đơn chờ hoàn quá 24 giờ mà chưa có tài khoản), mỗi sáng.
export async function remindRefundAccounts(): Promise<{ reminded: number }> {
  const before = new Date(now().getTime() - 24 * 3_600_000);
  const orders = await db.order.findMany({
    where: { status: 'refund_pending', updatedAt: { lt: before }, refundAccount: { equals: Prisma.DbNull } },
    select: { id: true, code: true, total: true, buyerId: true },
    take: 500,
  });
  let reminded = 0;
  for (const o of orders) {
    const buyer = await db.user.findUnique({
      where: { id: o.buyerId },
      select: { email: true, displayName: true },
    });
    if (!buyer?.email) continue;
    const subject = `Nhập tài khoản để nhận hoàn ${formatVnd(o.total)} cho đơn ${o.code}`;
    await sendMail({
      to: buyer.email,
      subject,
      ...renderEmail({
        title: subject,
        greeting: `Chào ${buyer.displayName},`,
        paragraphs: [
          `9MUA đang chờ bạn nhập tài khoản ngân hàng để chuyển hoàn ${formatVnd(o.total)} cho đơn ${o.code}.`,
        ],
        action: { label: 'Nhập tài khoản nhận hoàn tiền', url: `${env().APP_URL}/don-mua/${o.id}` },
      }),
    });
    reminded += 1;
  }
  return { reminded };
}
