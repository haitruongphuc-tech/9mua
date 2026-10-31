import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { formatDateTime } from '@/lib/format';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { fakeReportBannedUntil, FAKE_REASONS, myFakeReports, ordersWithProduct } from '@/modules/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tố cáo hàng giả', robots: { index: false } };

const ERRORS = [
  'NOT_FOUND',
  'INVALID',
  'HAS_LINK',
  'BANNED',
  'ORDER_INVALID',
  'IMAGE_INVALID',
  'DUPLICATE',
] as const;

// Tố cáo hàng giả (SPEC-orders.md V5.2): lý do, mô tả 20–2.000 ký tự, tối đa 5 ảnh, chọn đơn đã mua (nếu có).
// 9MUA xử lý trong 24 giờ.
export default async function FakeReportPage({
  searchParams,
}: {
  searchParams: Promise<{ sp?: string; loi?: string; 'da-gui'?: string }>;
}) {
  if (!(await isFeatureOn('fake_report'))) notFound();
  const user = await requireUser();
  const [t, query] = await Promise.all([getT(), searchParams]);
  const productId = query.sp ?? '';
  const [orders, banned, mine] = await Promise.all([
    productId ? ordersWithProduct(user.id, productId) : [],
    fakeReportBannedUntil(user.id),
    myFakeReports(user.id),
  ]);
  const sent = mine.find((r) => r.id === query['da-gui']);
  const err = ERRORS.find((e) => e === query.loi);
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[20px] font-black">⚠ {t('shop.fake.title')}</h1>
      {sent ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/15 px-4 py-3 text-[13px] font-bold text-green-300"
          data-testid="fake-sent"
        >
          {t('shop.fake.sent', { deadline: formatDateTime(sent.deadlineAt, t.lang) })}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="text-[13px] font-bold text-red-300" data-testid="fake-error">
          {t(`shop.fake.err.${err}`)}
        </p>
      ) : null}
      {banned ? (
        <p className="text-[13px] text-white/70">
          {t('shop.fake.banned', { date: formatDateTime(banned, t.lang) })}
        </p>
      ) : productId && !sent ? (
        <form
          action="/api/to-cao-hang-gia"
          method="post"
          encType="multipart/form-data"
          className="flex flex-col gap-3"
          data-testid="fake-form"
        >
          <input type="hidden" name="productId" value={productId} />
          <fieldset className="flex flex-col gap-2 text-[13px]">
            {FAKE_REASONS.map((r, i) => (
              <label key={r} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  defaultChecked={i === 0}
                  className="accent-[#ff6b00]"
                />
                {t(`shop.fake.reason.${r}`)}
              </label>
            ))}
          </fieldset>
          <textarea
            name="text"
            required
            minLength={20}
            maxLength={2000}
            rows={5}
            placeholder={t('shop.fake.textHint')}
            className="rounded-[12px] border border-white/15 bg-white/5 p-3 text-[14px]"
          />
          <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
            {t('shop.fake.images')}
            <input
              name="images"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="text-[12px]"
            />
          </label>
          {orders.length ? (
            <select
              name="orderId"
              defaultValue=""
              className="h-11 rounded-[12px] border border-white/15 bg-white/5 px-3 text-[14px]"
            >
              <option value="">{t('shop.fake.noOrder')}</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {t('shop.order.title', { code: o.code })}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="submit"
            className="h-11 rounded-full bg-danger text-[14px] font-black"
            data-testid="fake-submit"
          >
            {t('shop.fake.submit')}
          </button>
        </form>
      ) : null}
      {mine.length ? (
        <ul className="flex flex-col gap-2 text-[13px]" data-testid="fake-mine">
          {mine.map((r) => (
            <li key={r.id} className="rounded-[12px] bg-white/5 px-3 py-2">
              {t(`shop.fake.status.${r.status}` as 'shop.fake.status.open', {
                deadline: formatDateTime(r.deadlineAt, t.lang),
              })}
              {r.resolution ? ` — ${r.resolution}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
