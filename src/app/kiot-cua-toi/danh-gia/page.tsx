import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { MAX_REPLY_TEXT, reviewsForKiot } from '@/modules/orders';
import { replyReviewAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Đánh giá', robots: { index: false } };

// Chủ Kiot xem đánh giá và trả lời mỗi đánh giá 1 lần (SPEC-orders.md V5.1 mục 4). Không xoá / ẩn được.
export default async function SellerReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string }>;
}) {
  const user = await requireUser();
  const [t, reviews, query] = await Promise.all([getT(), reviewsForKiot(user.id), searchParams]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-[20px] font-black">{t('seller.reviews.title')}</h1>
      {query.loi ? (
        <p role="alert" className="text-[13px] font-bold text-red-300">
          {t('seller.reviews.error')}
        </p>
      ) : null}
      {reviews.length === 0 ? <p className="text-[13px] text-white/60">{t('seller.reviews.empty')}</p> : null}
      <ul className="flex flex-col gap-3" data-testid="seller-reviews">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-white/5 p-3">
            <p className="flex justify-between text-[12px]">
              <span className="font-bold">
                {r.buyerName} · {r.itemName}
              </span>
              <span className="text-white/50">{formatDate(r.createdAt, t.lang)}</span>
            </p>
            <p className="text-amber-300">{'★'.repeat(r.stars)}</p>
            {r.text ? <p className="whitespace-pre-line text-[13px]">{r.text}</p> : null}
            {r.reply ? (
              <p className="rounded-[10px] bg-white/5 p-2 text-[12px]">
                <span className="font-bold">{t('shop.review.kiotReply')}</span> {r.reply}
              </p>
            ) : (
              <form action={replyReviewAction.bind(null, r.id)} className="flex flex-col gap-2">
                <textarea
                  name="text"
                  required
                  rows={2}
                  maxLength={MAX_REPLY_TEXT}
                  placeholder={t('seller.reviews.replyHint')}
                  className="rounded-[10px] border border-white/15 bg-white/5 p-2 text-[13px]"
                  data-testid="review-reply-text"
                />
                <button
                  type="submit"
                  className="h-9 w-fit rounded-full bg-brand px-4 text-[12px] font-black"
                  data-testid="review-reply-submit"
                >
                  {t('seller.reviews.reply')}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
