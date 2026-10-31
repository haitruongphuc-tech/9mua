import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import { isFeatureOn } from '@/lib/features';
import { getKiotByOwner, latestOrigin } from '@/modules/kiot';
import { requireUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Hồ sơ nguồn gốc', robots: { index: false } };

const ERRORS = [
  'PENDING',
  'NEED_DOCUMENT',
  'NEED_PHOTOS',
  'TOO_MANY_PHOTOS',
  'NEED_COMMIT',
  'FILE_INVALID',
  'VIDEO_INVALID',
] as const;
const file = 'text-[12px]';

// Hồ sơ nguồn gốc (SPEC-kiot.md V5.2): hoá đơn / giấy chứng nhận, ≥ 3 ảnh hàng thật, video ≤ 60 giây (không bắt buộc),
// 2 cam kết. CEO duyệt; có hạn 12 tháng.
export default async function OriginPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-gui'?: string }>;
}) {
  if (!(await isFeatureOn('origin'))) notFound();
  const user = await requireUser();
  const [t, query, kiot] = await Promise.all([getT(), searchParams, getKiotByOwner(user.id)]);
  if (!kiot) notFound();
  const d = await latestOrigin(kiot.id);
  const err = ERRORS.find((e) => e === query.loi);
  const status = d
    ? d.status === 'approved' && d.expiresAt && d.expiresAt.getTime() < Date.now()
      ? 'expired'
      : d.status
    : 'none';
  const canSubmit = status !== 'pending';
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-[20px] font-black">{t('seller.origin.title')}</h1>
      <p className="text-[13px] text-white/70">{t('seller.origin.lead')}</p>
      <p
        className="rounded-[14px] bg-white/5 px-4 py-3 text-[13px] font-bold"
        data-testid="origin-status"
        data-status={status}
      >
        {t(`seller.origin.status.${status}` as 'seller.origin.status.none', {
          date: d?.expiresAt ? formatDate(d.expiresAt, t.lang) : '',
          reason: d?.reason ?? '',
        })}
      </p>
      {query['da-gui'] ? (
        <p role="status" className="text-[13px] font-bold text-green-300">
          {t('seller.origin.sent')}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="text-[13px] font-bold text-red-300" data-testid="origin-error">
          {t(`seller.origin.err.${err}`)}
        </p>
      ) : null}
      {canSubmit ? (
        <form
          action="/api/kiot/nguon-goc"
          method="post"
          encType="multipart/form-data"
          className="flex flex-col gap-3"
          data-testid="origin-form"
        >
          <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('seller.origin.invoice')}
            <input
              name="invoice"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className={file}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('seller.origin.certificate')}
            <input
              name="certificate"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className={file}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('seller.origin.photos')}
            <input
              name="photos"
              type="file"
              multiple
              required
              accept="image/jpeg,image/png,image/webp"
              className={file}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('seller.origin.video')}
            <input name="video" type="file" accept="video/mp4,video/quicktime,video/webm" className={file} />
          </label>
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" name="commitOrigin" required className="mt-1 h-4 w-4 accent-[#ff6b00]" />
            {t('seller.origin.commitOrigin')}
          </label>
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" name="commitRefund" required className="mt-1 h-4 w-4 accent-[#ff6b00]" />
            {t('seller.origin.commitRefund')}
          </label>
          <button
            type="submit"
            className="h-11 rounded-full bg-brand text-[14px] font-black"
            data-testid="origin-submit"
          >
            {t('seller.origin.submit')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
