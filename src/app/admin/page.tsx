import Link from 'next/link';
import { LineChart } from '@/components/admin/LineChart';
import { formatVnd } from '@/lib/format';
import { getMetrics, getTodo, RANGES, requireAdminVerified, revenueByDay, type Range } from '@/modules/admin';

export const dynamic = 'force-dynamic';

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ khoang?: string }> }) {
  await requireAdminVerified();
  const { khoang } = await searchParams;
  const range: Range = RANGES.find((r) => r.value === khoang)?.value ?? 'hom-nay';
  const [todo, m, series] = await Promise.all([getTodo(), getMetrics(range), revenueByDay(30)]);
  const cards: [string, string][] = [
    ['Người dùng mới', m.newUsers.toLocaleString('vi-VN')],
    ['Kiot mới', m.newKiots.toLocaleString('vi-VN')],
    ['Kiot đang hoạt động', m.activeKiots.toLocaleString('vi-VN')],
    ['Doanh số đơn đã trả (GMV)', formatVnd(m.gmv)],
    ['Phí sàn thu được', formatVnd(m.platformFees)],
    ['Phí thuê Kiot', formatVnd(m.kiotFees)],
    ['Đã chi cho người bán', formatVnd(m.paidOut)],
    ['Tiền đang giữ hộ (hiện tại)', formatVnd(m.held)],
    ['Video mới', m.newVideos.toLocaleString('vi-VN')],
    ['Lượt xem video', m.views.toLocaleString('vi-VN')],
  ];
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <div className="rounded-2xl border-2 border-brand-ink p-4" data-testid="todo-box">
        <h1 className="mb-2 text-lg font-extrabold">Cần xử lý</h1>
        {todo.length === 0 ? (
          <p className="text-sm text-success">Không có việc nào đang chờ. 👍</p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10">
            {todo.map((t) => (
              <li key={t.key}>
                <Link
                  href={t.href}
                  className="flex items-center justify-between gap-3 py-3 font-bold"
                  data-testid={`todo-${t.key}`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-sm ${t.urgent ? 'bg-danger text-white' : 'bg-brand text-brand-ink'}`}
                  >
                    {t.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <nav aria-label="Khoảng thời gian" className="flex gap-2 text-sm font-bold">
        {RANGES.map((r) => (
          <Link
            key={r.value}
            href={`/admin?khoang=${r.value}`}
            aria-current={r.value === range ? 'page' : undefined}
            className={`rounded-full border-2 px-3 py-1.5 ${r.value === range ? 'border-brand-ink bg-brand/15' : 'border-black/10'}`}
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-testid="metrics">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface-muted p-3">
            <dt className="text-xs text-black/60">{label}</dt>
            <dd className="text-lg font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-2xl border-2 border-black/10 p-4">
        <LineChart
          label="Doanh thu 30 ngày (phí sàn + phí thuê Kiot)"
          points={series.map((s) => ({ day: s.day, value: s.platform + s.kiot }))}
        />
      </div>
    </section>
  );
}
