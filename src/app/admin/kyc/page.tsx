import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { listKycForReview } from '@/modules/payouts';
import type { FlashParams } from '../flash';
import { reviewKycAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function KycQueuePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [items, params] = await Promise.all([listKycForReview('pending'), searchParams]);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">KYC chờ duyệt</h1>
      <Flash ok={params.xong} error={params.loi} />
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white/5 p-6 text-center text-white/70">Không có hồ sơ nào.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((k) => (
          <li
            key={k.id}
            className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
            data-testid="kyc-row"
          >
            <p className="font-extrabold">
              {k.fullName} · {k.idNumber}
            </p>
            <p className="text-sm text-white/70">
              Kiot: {k.kiotName ?? '—'} · nộp {formatDateTimeVN(k.createdAt)}
            </p>
            <p className={`text-sm font-bold ${k.nameMatchesBank === false ? 'text-red-400' : ''}`}>
              Tài khoản nhận tiền: {k.bankAccountName ?? 'chưa khai báo'}
              {k.nameMatchesBank === false ? ' ⚠ khác tên trên CCCD' : k.nameMatchesBank ? ' ✓ khớp tên' : ''}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['front', 'back'] as const).map((side) => (
                <a
                  key={side}
                  href={`/api/admin/kyc/${k.id}/${side}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-xl bg-white/5"
                >
                  {/* Ảnh CCCD qua route có kiểm quyền admin + 2 lớp, không có đường công khai. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/admin/kyc/${k.id}/${side}`}
                    alt={side === 'front' ? 'Mặt trước' : 'Mặt sau'}
                    className="aspect-[3/2] w-full object-cover"
                  />
                </a>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={reviewKycAction.bind(null, k.id, 'approve')}>
                <ConfirmSubmit confirm={`Duyệt CCCD của ${k.fullName}?`} testId="kyc-approve">
                  Duyệt
                </ConfirmSubmit>
              </form>
              <form action={reviewKycAction.bind(null, k.id, 'reject')} className="flex min-w-0 flex-1 gap-2">
                <input
                  name="reason"
                  required
                  placeholder="Lý do từ chối"
                  className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 text-white px-3"
                />
                <ConfirmSubmit confirm="Từ chối hồ sơ này?" tone="danger">
                  Từ chối
                </ConfirmSubmit>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
