import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { formatDateTime } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKycStatus } from '@/modules/payouts';

export const metadata: Metadata = { title: 'Xác minh danh tính', robots: { index: false } };

const ERRORS = [
  'INVALID_INPUT',
  'INVALID_IMAGE',
  'TOO_LARGE',
  'ALREADY_PENDING',
  'ALREADY_APPROVED',
] as const;

const field =
  'h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand';
const label = 'flex flex-col gap-1.5 text-[12px] font-bold text-white/70';

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-gui'?: string }>;
}) {
  const user = await requireUser();
  const [status, params, t] = await Promise.all([getKycStatus(user.id), searchParams, getT()]);
  const code = ERRORS.find((c) => c === params.loi);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.kyc.title')}</h1>
      <p className="text-[13px] text-white/60">{t('seller.kyc.intro')}</p>
      {params.loi ? (
        <p role="alert" className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300">
          {code ? t(`seller.kyc.err.${code}`) : t('seller.kyc.err.other')}
        </p>
      ) : null}
      {params['da-gui'] ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('seller.kyc.sent')}
        </p>
      ) : null}
      {status ? (
        <p
          className="rounded-[14px] border border-white/10 bg-white/5 p-4 text-[13px]"
          data-testid="kyc-status"
        >
          {status.status === 'approved'
            ? t('seller.kyc.approved', { name: status.fullName })
            : status.status === 'pending'
              ? t('seller.kyc.pending', { date: formatDateTime(status.createdAt, t.lang) })
              : t('seller.kyc.rejected', { reason: status.reason ?? '' })}
        </p>
      ) : null}
      {!status || status.status === 'rejected' ? (
        <form
          method="post"
          action="/api/kyc/submit"
          encType="multipart/form-data"
          className="flex flex-col gap-3"
        >
          <label className={label}>
            {t('seller.kyc.fullName')}
            <input name="fullName" id="kyc-name" required className={field} />
          </label>
          <label className={label}>
            {t('seller.kyc.idNumber')}
            <input name="idNumber" id="kyc-number" required inputMode="numeric" className={field} />
          </label>
          <label className={label}>
            {t('seller.kyc.front')}
            <input
              name="front"
              id="kyc-front"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="text-[13px] text-white"
            />
          </label>
          <label className={label}>
            {t('seller.kyc.back')}
            <input
              name="back"
              id="kyc-back"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="text-[13px] text-white"
            />
          </label>
          <button className="h-12 rounded-full bg-brand font-black text-white">
            {t('seller.kyc.submit')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
