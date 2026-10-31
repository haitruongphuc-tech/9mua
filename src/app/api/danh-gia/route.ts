import { env } from '@/lib/env';
import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { createReview, editReview } from '@/modules/orders';

export const dynamic = 'force-dynamic';

const MAX_BODY = 52 * 1024 * 1024;

// Viết / sửa đánh giá (SPEC-orders.md V5.1). Form gửi thẳng tới đây vì có ảnh (server action chỉ nhận 1MB).
export async function POST(request: Request) {
  const off = await featureGuard('reviews');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const form =
    Number(request.headers.get('content-length') ?? 0) > MAX_BODY
      ? null
      : await request.formData().catch(() => null);
  const orderId = String(form?.get('orderId') ?? '');
  const itemId = String(form?.get('itemId') ?? '');
  const reviewId = String(form?.get('reviewId') ?? '');
  const stars = Number(form?.get('stars'));
  const text = String(form?.get('text') ?? '');
  const files = (form?.getAll('images') ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  const r = !form
    ? { ok: false as const, error: 'INVALID' }
    : reviewId
      ? await editReview(user.id, reviewId, { stars, text })
      : await createReview(user.id, itemId, {
          stars,
          text,
          images: await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()))),
        });
  const back = `/don-mua/${encodeURIComponent(orderId)}/danh-gia/${encodeURIComponent(itemId)}`;
  return Response.redirect(`${env().APP_URL}${back}${r.ok ? '?da-luu=1' : `?loi=${r.error}`}`, 303);
}
