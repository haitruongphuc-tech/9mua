import Image from 'next/image';
import Link from 'next/link';
import type { getT } from '@/i18n/server';
import { formatDate } from '@/lib/format';
import type { ReviewSummary, ReviewView } from '@/modules/orders';
import { reportReviewAction } from './review-actions';

// Khu đánh giá trên trang sản phẩm (SPEC-orders.md V5.1 mục 6): trung bình, tổng số, phân bố 5→1 sao, lọc "Có ảnh" và
// theo số sao; mỗi đánh giá ghi "Đã mua · <tên lúc mua>", trả lời của Kiot, nút báo cáo.
export function ProductReviews({
  summary,
  items,
  filter,
  basePath,
  loggedIn,
  t,
}: {
  summary: ReviewSummary;
  items: ReviewView[];
  filter: { stars?: number; withMedia?: boolean };
  basePath: string;
  loggedIn: boolean;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-[12px] font-bold ${active ? 'bg-white text-ink' : 'bg-white/10'}`;
  return (
    <section
      className="border-t border-white/10 pt-4"
      aria-labelledby="danh-gia"
      data-testid="product-reviews"
    >
      <h2 id="danh-gia" className="mb-2 font-display text-[16px] font-black">
        {t('shop.review.section', { count: summary.count })}
      </h2>
      {summary.count ? (
        <div className="mb-3 flex items-center gap-4">
          <p className="text-[28px] font-black text-amber-300" data-testid="review-avg">
            {summary.avg.toLocaleString(t.lang)}★
          </p>
          <ul className="flex flex-1 flex-col gap-0.5 text-[11px] text-white/70">
            {([5, 4, 3, 2, 1] as const).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className="w-6">{s}★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full bg-amber-300"
                    style={{ width: `${summary.count ? (summary.dist[s] / summary.count) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-6 text-right">{summary.dist[s]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] text-white/50">{t('shop.review.none')}</p>
      )}
      {summary.count ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <Link href={`${basePath}#danh-gia`} className={chip(!filter.stars && !filter.withMedia)}>
            {t('shop.review.all')}
          </Link>
          <Link href={`${basePath}?co-anh=1#danh-gia`} className={chip(Boolean(filter.withMedia))}>
            {t('shop.review.withMedia')}
          </Link>
          {[5, 4, 3, 2, 1].map((s) => (
            <Link key={s} href={`${basePath}?sao=${s}#danh-gia`} className={chip(filter.stars === s)}>
              {s}★
            </Link>
          ))}
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-1 rounded-[14px] bg-white/5 p-3"
            data-testid="review-item"
          >
            <p className="flex items-center justify-between text-[12px]">
              <span className="font-bold">{r.buyerName}</span>
              <span className="text-white/50">{formatDate(r.createdAt, t.lang)}</span>
            </p>
            <p className="text-[14px] text-amber-300">
              {'★'.repeat(r.stars)}
              <span className="text-white/20">{'★'.repeat(5 - r.stars)}</span>
            </p>
            <p className="text-[11px] text-white/50">{t('shop.review.bought', { name: r.itemName })}</p>
            {r.text ? <p className="whitespace-pre-line text-[13px]">{r.text}</p> : null}
            {r.media.length ? (
              <div className="flex gap-2">
                {r.media.map((m) => (
                  <a key={m.url} href={m.url} className="relative h-16 w-16 overflow-hidden rounded-[10px]">
                    <Image src={m.thumbUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
                  </a>
                ))}
              </div>
            ) : null}
            {r.edited ? <p className="text-[11px] text-white/40">{t('shop.review.edited')}</p> : null}
            {r.reply ? (
              <p className="mt-1 rounded-[10px] bg-white/5 p-2 text-[12px]" data-testid="review-reply">
                <span className="font-bold">{t('shop.review.kiotReply')}</span> {r.reply}
              </p>
            ) : null}
            {loggedIn ? (
              <form action={reportReviewAction.bind(null, r.id, basePath)} className="self-end">
                <button type="submit" className="text-[11px] text-white/40 hover:text-white/70">
                  ⚑ {t('shop.review.report')}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
