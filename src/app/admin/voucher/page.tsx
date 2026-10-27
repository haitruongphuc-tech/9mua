import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { listVouchers } from '@/modules/social';
import type { FlashParams } from '../flash';
import { revokeVoucherAction } from './actions';

export const dynamic = 'force-dynamic';

// Voucher mở Kiot tặng khi thả tim đủ video (SPEC-social.md mục 8). CEO thu hồi voucher chưa dùng nếu nghi tài khoản ảo.
export default async function AdminVoucherPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [rows, params] = await Promise.all([listVouchers(200), searchParams]);
  const state = (v: (typeof rows)[number]) =>
    v.revokedAt ? 'Đã thu hồi' : v.usedAt ? 'Đã dùng' : 'Chưa dùng';
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Voucher mở Kiot</h1>
      <Flash ok={params.xong} error={params.loi} />
      <p className="text-sm text-white/70">
        Mỗi tài khoản nhận tối đa 1 voucher (= 1 năm phí Kiot) khi thả tim đủ số video đặt ở Cài đặt. Luật và
        công tắc tặng voucher chỉnh ở trang Cài đặt.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-white/60">Chưa có voucher nào.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="vouchers">
          {rows.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm"
            >
              <p className="font-bold">
                {v.user?.displayName ?? v.userId} · {v.user?.phone ?? v.user?.email ?? '—'}
              </p>
              <p className="text-white/70">
                Nhận {formatDateTimeVN(v.issuedAt)} ·{' '}
                <span className={v.revokedAt ? 'text-red-400' : v.usedAt ? 'text-green-400' : 'text-brand'}>
                  {state(v)}
                </span>
                {v.usedAt ? ` ${formatDateTimeVN(v.usedAt)}` : ''}
                {v.revokedAt ? ` ${formatDateTimeVN(v.revokedAt)} — ${v.revokeReason ?? ''}` : ''}
              </p>
              {!v.usedAt && !v.revokedAt ? (
                <form action={revokeVoucherAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="voucherId" value={v.id} />
                  <input
                    name="reason"
                    required
                    minLength={3}
                    placeholder="Lý do thu hồi"
                    className="h-10 min-w-0 flex-1 rounded-[12px] border border-white/15 bg-white/10 px-3 text-white"
                  />
                  <ConfirmSubmit confirm="Thu hồi voucher này?" tone="danger">
                    Thu hồi
                  </ConfirmSubmit>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
