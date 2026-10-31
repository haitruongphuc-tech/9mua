import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { requireUser } from '@/modules/identity';
import { canReviewItem, getOrderForBuyer, MAX_REVIEW_TEXT, myReview } from '@/modules/orders';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Đánh giá sản phẩm', robots: { index: false } };

const ERRORS = [
  'NOT_FOUND',
  'NOT_ALLOWED',
  'EXPIRED',
  'EXISTS',
  'INVALID',
  'HAS_LINK',
  'EDIT_USED',
  'IMAGE_INVALID',
] as const;

// Viết đánh giá cho một món đã mua (SPEC-orders.md V5.1): 1–5 sao, chữ ≤ 1.000, tối đa 5 ảnh; sửa 1 lần trong 7 ngày.
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ loi?: string; 'da-luu'?: string }>;
}) {
  if (!(await isFeatureOn('reviews'))) notFound();
  const user = await requireUser();
  const [{ id, itemId }, query, t] = await Promise.all([params, searchParams, getT()]);
  const order = await getOrderForBuyer(user.id, id);
  const item = order?.items.find((i) => i.id === itemId);
  if (!order || !item) notFound();
  const [mine, allowed] = await Promise.all([myReview(user.id, itemId), canReviewItem(user.id, itemId)]);
  const err = ERRORS.find((e) => e === query.loi);
  const canEdit = mine && !mine.editedAt && mine.createdAt.getTime() > Date.now() - 7 * 86_400_000;
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link href={`/don-mua/${order.id}`} className="text-[13px] font-bold text-white/60">
        ← {t('shop.order.title', { code: order.code })}
      </Link>
      <h1 className="font-display text-[20px] font-black">{t('shop.review.title')}</h1>
      <p className="text-[14px] font-bold">{item.name}</p>
      {query['da-luu'] ? (
        <p role="status" className="text-[13px] font-bold text-green-300" data-testid="review-saved">
          {t('shop.review.saved')}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="text-[13px] font-bold text-red-300" data-testid="review-error">
          {t(`shop.review.err.${err}`)}
        </p>
      ) : null}
      {mine ? (
        <div
          className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-white/5 p-3"
          data-testid="review-mine"
        >
          <p className="text-[16px] text-amber-300">
            {'★'.repeat(mine.stars)}
            {'☆'.repeat(5 - mine.stars)}
          </p>
          {mine.text ? <p className="whitespace-pre-line text-[14px]">{mine.text}</p> : null}
          <div className="flex gap-2">
            {mine.media.map((m) => (
              <span key={m.id} className="relative h-16 w-16 overflow-hidden rounded-[10px]">
                <Image src={m.thumbUrl} alt="" fill sizes="64px" className="object-cover" unoptimized />
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {!mine && allowed ? <ReviewForm orderId={order.id} itemId={itemId} t={t} /> : null}
      {mine && canEdit ? <ReviewForm orderId={order.id} itemId={itemId} t={t} edit={mine} /> : null}
      {!mine && !allowed ? (
        <p className="text-[13px] text-white/60">{t('shop.review.err.NOT_ALLOWED')}</p>
      ) : null}
    </section>
  );
}

function ReviewForm({
  orderId,
  itemId,
  t,
  edit,
}: {
  orderId: string;
  itemId: string;
  t: Awaited<ReturnType<typeof getT>>;
  edit?: { id: string; stars: number; text: string };
}) {
  return (
    <form
      action="/api/danh-gia"
      method="post"
      encType="multipart/form-data"
      className="flex flex-col gap-3"
      data-testid="review-form"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="itemId" value={itemId} />
      {edit ? <input type="hidden" name="reviewId" value={edit.id} /> : null}
      <fieldset className="flex gap-3 text-[14px]">
        <legend className="mb-1 text-[12px] font-bold text-white/70">{t('shop.review.stars')}</legend>
        {[5, 4, 3, 2, 1].map((s) => (
          <label key={s} className="flex items-center gap-1">
            <input
              type="radio"
              name="stars"
              value={s}
              required
              defaultChecked={edit ? edit.stars === s : s === 5}
              className="accent-[#ff6b00]"
              data-testid={`review-star-${s}`}
            />
            {s}★
          </label>
        ))}
      </fieldset>
      <textarea
        name="text"
        rows={4}
        maxLength={MAX_REVIEW_TEXT}
        defaultValue={edit?.text ?? ''}
        placeholder={t('shop.review.textHint')}
        className="rounded-[12px] border border-white/15 bg-white/5 p-3 text-[14px]"
      />
      {edit ? null : (
        <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('shop.review.images')}
          <input
            name="images"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="text-[12px]"
          />
        </label>
      )}
      <button
        type="submit"
        className="h-11 rounded-full bg-brand text-[14px] font-black"
        data-testid="review-submit"
      >
        {edit ? t('shop.review.edit') : t('shop.review.submit')}
      </button>
    </form>
  );
}
