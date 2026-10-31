import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { PROVINCES } from '@/modules/kiot';
import { createEventAction } from '../actions';

export const metadata: Metadata = { robots: { index: false } };

const ERRORS = ['INVALID', 'TIME_INVALID', 'PLACE_INVALID', 'HAS_LINK', 'LIMIT'] as const;

// Tạo sự kiện (SPEC-social.md V5.7 mục 1): tên ≤ 80, giờ bắt đầu / kết thúc, Live hoặc tại địa điểm, tỉnh + địa chỉ ≤ 120,
// mô tả ≤ 1.000. Ảnh bìa thêm ở trang sự kiện sau khi tạo.
export default async function CreateEventPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  await requireUser();
  if (!(await isFeatureOn('events'))) notFound();
  const [t, { loi }] = await Promise.all([getT(), searchParams]);
  const err = ERRORS.find((e) => e === loi);
  const field = 'h-11 w-full rounded-[14px] border border-white/15 bg-white/10 px-3 text-[14px] text-white';
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-bold">{t('feed.event.create')}</h1>
      {err ? (
        <p role="alert" className="rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300">
          {t(`feed.event.err.${err}`)}
        </p>
      ) : null}
      <form action={createEventAction} className="flex flex-col gap-3" data-testid="event-form">
        <input
          name="title"
          required
          maxLength={80}
          placeholder={t('feed.event.titleHint')}
          className={field}
        />
        <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('feed.event.startsAt')}
          <input name="startsAt" type="datetime-local" required className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('feed.event.endsAt')}
          <input name="endsAt" type="datetime-local" required className={field} />
        </label>
        <select name="mode" defaultValue="place" className={field} aria-label={t('feed.event.mode')}>
          <option value="place">{t('feed.event.modePlace')}</option>
          <option value="live">{t('feed.event.modeLive')}</option>
        </select>
        <select name="province" defaultValue="" className={field} aria-label={t('feed.event.province')}>
          <option value="">{t('feed.event.noProvince')}</option>
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <input name="address" maxLength={120} placeholder={t('feed.event.addressHint')} className={field} />
        <textarea
          name="description"
          maxLength={1000}
          rows={5}
          placeholder={t('feed.event.descriptionHint')}
          className={`${field} h-auto py-2`}
        />
        <button
          type="submit"
          className="h-12 rounded-full bg-brand font-black text-white"
          data-testid="event-submit"
        >
          {t('feed.event.create')}
        </button>
      </form>
    </div>
  );
}
