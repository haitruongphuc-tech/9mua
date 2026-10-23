import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';
import { listMismatches } from '@/modules/payments';
import { checkPayoutFund, custodyReport } from '@/modules/payouts';

export type Range = 'hom-nay' | '7-ngay' | '30-ngay';
export const RANGES: { value: Range; label: string; days: number }[] = [
  { value: 'hom-nay', label: 'Hôm nay', days: 1 },
  { value: '7-ngay', label: '7 ngày', days: 7 },
  { value: '30-ngay', label: '30 ngày', days: 30 },
];

export function rangeStart(range: Range): Date {
  const days = RANGES.find((r) => r.value === range)?.days ?? 1;
  return new Date(startOfVnDay().getTime() - (days - 1) * 86_400_000);
}

export type TodoItem = { key: string; label: string; count: number; href: string; urgent?: boolean };

// Hộp "Cần xử lý" (SPEC-admin.md mục 2): mỗi dòng có số lượng và link tới đúng hàng chờ. Chỉ hiện dòng > 0.
export async function getTodo(): Promise<TodoItem[]> {
  const stuckBefore = new Date(now().getTime() - 2 * 3_600_000);
  const weekAgo = new Date(now().getTime() - 7 * 86_400_000);
  const [
    payouts,
    kyc,
    refunds,
    disputes,
    mismatches,
    productReports,
    videoReports,
    stuck,
    failedVideos,
    fund,
  ] = await Promise.all([
    db.payoutRequest.count({ where: { status: 'pending' } }),
    db.kycSubmission.count({ where: { status: 'pending' } }),
    db.order.count({ where: { status: 'refund_pending' } }),
    db.order.count({ where: { status: 'disputed' } }),
    listMismatches().then((l) => l.length),
    db.productReport.findMany({
      where: { status: 'open' },
      distinct: ['productId'],
      select: { productId: true },
    }),
    db.videoReport.findMany({ where: { status: 'open' }, distinct: ['videoId'], select: { videoId: true } }),
    db.payoutRequest.count({
      where: {
        OR: [
          { status: 'processing', dispatchedAt: { lt: stuckBefore } },
          { status: 'processing', payosState: 'ON_HOLD' },
        ],
      },
    }),
    db.videoJob.count({ where: { status: 'failed', attempts: { gte: 3 }, updatedAt: { gte: weekAgo } } }),
    checkPayoutFund().catch(() => null),
  ]);
  const items: TodoItem[] = [
    { key: 'payouts', label: 'Yêu cầu rút tiền chờ duyệt', count: payouts, href: '/admin/rut-tien' },
    { key: 'kyc', label: 'KYC chờ duyệt', count: kyc, href: '/admin/kyc' },
    { key: 'refunds', label: 'Đơn chờ hoàn tiền', count: refunds, href: '/admin/hoan-tien', urgent: true },
    { key: 'disputes', label: 'Khiếu nại', count: disputes, href: '/admin/khieu-nai', urgent: true },
    {
      key: 'mismatches',
      label: 'Thanh toán lệch tiền',
      count: mismatches,
      href: '/admin/lech-tien',
      urgent: true,
    },
    {
      key: 'reports',
      label: 'Báo cáo sản phẩm/video',
      count: productReports.length + videoReports.length,
      href: '/admin/bao-cao',
    },
    {
      key: 'stuck',
      label: 'Lệnh chi PayOS treo',
      count: stuck,
      href: '/admin/rut-tien?trang-thai=processing',
      urgent: true,
    },
    {
      key: 'videos',
      label: 'Video xử lý lỗi nhiều lần',
      count: failedVideos,
      href: '/admin/bao-cao#video-loi',
    },
  ];
  if (fund && fund.fund < fund.open + 10_000_000)
    items.push({
      key: 'fund',
      label: 'Quỹ chi PayOS sắp hết — cần nạp thêm',
      count: 1,
      href: '/admin/rut-tien',
      urgent: true,
    });
  return items.filter((i) => i.count > 0);
}

export type Metrics = {
  newUsers: number;
  newKiots: number;
  activeKiots: number;
  gmv: number;
  platformFees: number;
  kiotFees: number;
  paidOut: number;
  held: number;
  newVideos: number;
  views: number;
};

// Số liệu tổng quan theo khoảng (giờ VN). Tiền đang giữ hộ là con số tại thời điểm xem.
export async function getMetrics(range: Range): Promise<Metrics> {
  const from = rangeStart(range);
  const to = new Date(now().getTime() + 1);
  const at = now();
  const [newUsers, newKiots, activeKiots, gmv, kiotFees, newVideos, views, custody] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: from } } }),
    db.kiot.count({ where: { createdAt: { gte: from } } }),
    db.kiot.count({ where: { activeUntil: { gt: at }, lockedAt: null } }),
    db.order.aggregate({ where: { paidAt: { gte: from } }, _sum: { total: true } }),
    db.kiotSubscription.aggregate({
      where: { source: 'payos', createdAt: { gte: from } },
      _sum: { amount: true },
    }),
    db.video.count({ where: { createdAt: { gte: from }, status: { not: 'deleted' } } }),
    db.videoView.count({ where: { createdAt: { gte: from } } }),
    custodyReport({ from, to }),
  ]);
  return {
    newUsers,
    newKiots,
    activeKiots,
    gmv: gmv._sum.total ?? 0,
    platformFees: custody.platformFees,
    kiotFees: kiotFees._sum.amount ?? 0,
    paidOut: custody.paidOut,
    held: custody.held,
    newVideos,
    views,
  };
}

const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

// Doanh thu theo ngày (phí sàn + phí thuê Kiot) cho biểu đồ, giờ VN. Ngày không có doanh thu = 0.
export async function revenueByDay(days = 30): Promise<{ day: string; platform: number; kiot: number }[]> {
  const from = new Date(startOfVnDay().getTime() - (days - 1) * 86_400_000);
  const [fees, subs] = await Promise.all([
    db.platformRevenue.findMany({
      where: { createdAt: { gte: from } },
      select: { fee: true, createdAt: true },
    }),
    db.kiotSubscription.findMany({
      where: { source: 'payos', createdAt: { gte: from } },
      select: { amount: true, createdAt: true },
    }),
  ]);
  const series = Array.from({ length: days }, (_, i) => ({
    day: vnDay(new Date(from.getTime() + i * 86_400_000)),
    platform: 0,
    kiot: 0,
  }));
  const byDay = new Map(series.map((s) => [s.day, s]));
  for (const f of fees) {
    const s = byDay.get(vnDay(f.createdAt));
    if (s) s.platform += f.fee;
  }
  for (const k of subs) {
    const s = byDay.get(vnDay(k.createdAt));
    if (s) s.kiot += k.amount;
  }
  return series;
}
