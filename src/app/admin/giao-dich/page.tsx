import { formatVnd } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { custodyReport } from '@/modules/payouts';

export const dynamic = 'force-dynamic';

const vnDate = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string; den?: string }>;
}) {
  await requireAdminVerified();
  const p = await searchParams;
  const tu = /^\d{4}-\d{2}-\d{2}$/.test(p.tu ?? '') ? p.tu! : vnDate(new Date(Date.now() - 29 * 86_400_000));
  const den = /^\d{4}-\d{2}-\d{2}$/.test(p.den ?? '') ? p.den! : vnDate(new Date());
  const r = await custodyReport({
    from: new Date(`${tu}T00:00:00+07:00`),
    to: new Date(new Date(`${den}T00:00:00+07:00`).getTime() + 86_400_000),
  });
  const qs = `tu=${tu}&den=${den}`;
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Giao dịch</h1>
      <form
        method="get"
        action="/admin/giao-dich"
        className="flex flex-wrap items-end gap-2 text-sm font-bold"
      >
        <label className="flex flex-col gap-1">
          Từ ngày
          <input
            type="date"
            name="tu"
            defaultValue={tu}
            className="h-11 rounded-xl border-2 border-black/15 px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          Đến ngày
          <input
            type="date"
            name="den"
            defaultValue={den}
            className="h-11 rounded-xl border-2 border-black/15 px-3"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-full border-2 border-brand-ink bg-brand px-5 font-extrabold text-brand-ink"
        >
          Xem
        </button>
      </form>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="ledger-summary">
        {[
          ['Tiền đang giữ hộ (hiện tại)', r.held],
          ['· số dư người bán', r.sellerBalances],
          ['· yêu cầu rút chưa chi', r.reserved],
          ['· đơn chưa hoàn tất / chờ hoàn', r.pendingOrders],
          ['Phí sàn trong kỳ', r.platformFees],
          ['Đã chi người bán trong kỳ', r.paidOut],
          ['Phí chi hộ trong kỳ', r.payoutFees],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl bg-surface-muted p-3">
            <dt className="text-xs text-black/60">{label}</dt>
            <dd className="text-lg font-extrabold">{formatVnd(value as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-black/70">
        Đối chiếu “Tiền đang giữ hộ” với số dư thật của TK MB 979393916 (trừ phí sàn và phí thuê Kiot chưa rút
        về).
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/admin/export?loai=vao&${qs}`}
          className="rounded-full border-2 border-brand-ink px-4 py-2 font-bold"
          data-testid="export-in"
        >
          Tải CSV tiền vào
        </a>
        <a
          href={`/api/admin/export?loai=ra&${qs}`}
          className="rounded-full border-2 border-brand-ink px-4 py-2 font-bold"
          data-testid="export-out"
        >
          Tải CSV tiền ra
        </a>
      </div>
    </section>
  );
}
