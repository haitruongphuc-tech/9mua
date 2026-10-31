import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { formatDateTime } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { fakeReportsForKiot, SELLER_RESPONSE_HOURS } from '@/modules/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tố cáo hàng giả', robots: { index: false } };

const ERRORS = ['NOT_FOUND', 'INVALID', 'IMAGE_INVALID', 'DUPLICATE', 'LATE'] as const;

// Tố cáo hàng giả về Kiot của tôi (SPEC-orders.md V5.2 mục 4): gửi giải trình kèm giấy tờ trong 12 giờ.
export default async function SellerFakeReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; 'da-gui'?: string }>;
}) {
  const user = await requireUser();
  const [t, reports, query] = await Promise.all([getT(), fakeReportsForKiot(user.id), searchParams]);
  const err = ERRORS.find((e) => e === query.loi);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-[20px] font-black">{t('seller.fake.title')}</h1>
      <p className="text-[13px] text-white/70">{t('seller.fake.lead', { hours: SELLER_RESPONSE_HOURS })}</p>
      {query['da-gui'] ? (
        <p role="status" className="text-[13px] font-bold text-green-300">
          {t('seller.fake.sent')}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="text-[13px] font-bold text-red-300">
          {t(`seller.fake.err.${err}`)}
        </p>
      ) : null}
      {reports.length === 0 ? <p className="text-[13px] text-white/60">{t('seller.fake.empty')}</p> : null}
      <ul className="flex flex-col gap-3" data-testid="seller-fake-reports">
        {reports.map((r) => {
          const open = (r.status === 'open' || r.status === 'investigating') && r.sellerResponse === null;
          const late = Date.now() > r.createdAt.getTime() + SELLER_RESPONSE_HOURS * 3_600_000;
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-[14px] border border-white/10 bg-white/5 p-3 text-[13px]"
            >
              <p className="font-bold">{t(`shop.fake.reason.${r.reason}` as 'shop.fake.reason.fake')}</p>
              <p className="whitespace-pre-line text-white/80">{r.text}</p>
              <p className="text-[12px] text-white/50">
                {t(`shop.fake.status.${r.status}` as 'shop.fake.status.open', {
                  deadline: formatDateTime(r.deadlineAt, t.lang),
                })}
              </p>
              {r.sellerResponse ? <p className="rounded-[10px] bg-white/5 p-2">{r.sellerResponse}</p> : null}
              {open && !late ? (
                <form
                  action="/api/to-cao-hang-gia"
                  method="post"
                  encType="multipart/form-data"
                  className="flex flex-col gap-2"
                >
                  <input type="hidden" name="reportId" value={r.id} />
                  <textarea
                    name="text"
                    required
                    maxLength={2000}
                    rows={3}
                    placeholder={t('seller.fake.responseHint')}
                    className="rounded-[10px] border border-white/15 bg-white/5 p-2"
                    data-testid="fake-response-text"
                  />
                  <input
                    name="images"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="text-[12px]"
                  />
                  <button
                    type="submit"
                    className="h-9 w-fit rounded-full bg-brand px-4 text-[12px] font-black"
                    data-testid="fake-response-submit"
                  >
                    {t('seller.fake.respond')}
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
