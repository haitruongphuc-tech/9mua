import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { getXuRules, monthlyXuUsage, recentXuEntries } from '@/modules/xu';
import type { FlashParams } from '../flash';
import { revokeXuAction, saveXuRulesAction } from './actions';

export const dynamic = 'force-dynamic';

const field = 'h-11 rounded-[14px] border border-white/15 bg-white/10 px-3 text-base text-white';

// Trang CEO cho xu (SPEC-live.md phần 2 mục 7, 9): luật thưởng, ngân sách tháng đã dùng, thu hồi.
export default async function AdminXuPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [rules, usage, entries, params] = await Promise.all([
    getXuRules(),
    monthlyXuUsage(),
    recentXuEntries(100),
    searchParams,
  ]);
  const tiers = [0, 1, 2].map((i) => rules.tiers[i] ?? [0, 0]);
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Xu thưởng live</h1>
      <Flash ok={params.xong} error={params.loi} />
      <p className="text-lg font-extrabold" data-testid="xu-usage">
        Tháng này đã thưởng {usage.used.toLocaleString('vi-VN')} / {usage.budget.toLocaleString('vi-VN')} xu
      </p>
      <form
        action={saveXuRulesAction}
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
      >
        <h2 className="font-extrabold">Mức thưởng (lấy mức cao nhất đạt được)</h2>
        {tiers.map(([v, x], i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            Từ
            <input
              name={`viewers${i + 1}`}
              defaultValue={v || ''}
              inputMode="numeric"
              className={`${field} w-24`}
            />
            người xem hợp lệ →
            <input
              name={`xu${i + 1}`}
              defaultValue={x || ''}
              inputMode="numeric"
              className={`${field} w-24`}
            />
            xu
          </div>
        ))}
        <label className="flex flex-col gap-1 text-sm font-bold">
          Ngân sách xu mỗi tháng
          <input
            name="monthlyBudget"
            defaultValue={rules.monthlyBudget}
            inputMode="numeric"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Số phút có hình tối thiểu
          <input name="minMinutes" defaultValue={rules.minMinutes} inputMode="numeric" className={field} />
        </label>
        <ConfirmSubmit confirm="Lưu luật thưởng xu? Áp dụng cho buổi live bắt đầu sau khi lưu.">
          Lưu luật
        </ConfirmSubmit>
      </form>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">Các dòng gần nhất</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-white/60">Chưa có dòng nào.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="xu-entries">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-3 text-sm"
              >
                <p>
                  <b className={e.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                    {e.amount > 0 ? '+' : ''}
                    {e.amount} xu
                  </b>{' '}
                  · {e.user?.displayName ?? e.userId} · {e.user?.phone ?? '—'} ·{' '}
                  {formatDateTimeVN(e.createdAt)}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
                {e.kind === 'live_reward' ? (
                  <form action={revokeXuAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="userId" value={e.userId} />
                    <input
                      name="amount"
                      defaultValue={e.amount}
                      inputMode="numeric"
                      className={`${field} w-24`}
                    />
                    <input
                      name="reason"
                      required
                      minLength={3}
                      placeholder="Lý do thu hồi"
                      className={`${field} min-w-0 flex-1`}
                    />
                    <ConfirmSubmit confirm="Thu hồi số xu này?" tone="danger">
                      Thu hồi
                    </ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
