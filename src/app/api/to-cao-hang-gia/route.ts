import { env } from '@/lib/env';
import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { respondFakeReport, submitFakeReport } from '@/modules/orders';

export const dynamic = 'force-dynamic';

const MAX_BODY = 52 * 1024 * 1024;
const images = async (form: FormData | null) =>
  Promise.all(
    (form?.getAll('images') ?? [])
      .filter((f): f is File => f instanceof File && f.size > 0)
      .map(async (f) => Buffer.from(await f.arrayBuffer())),
  );

// Tố cáo hàng giả (người mua) và giải trình (chủ Kiot) — SPEC-orders.md V5.2. Form có ảnh nên gửi thẳng tới đây.
export async function POST(request: Request) {
  const off = await featureGuard('fake_report');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const form =
    Number(request.headers.get('content-length') ?? 0) > MAX_BODY
      ? null
      : await request.formData().catch(() => null);
  const app = env().APP_URL;
  if (form?.get('reportId')) {
    const r = await respondFakeReport(user.id, String(form.get('reportId')), {
      text: String(form.get('text') ?? ''),
      images: await images(form),
    });
    return Response.redirect(`${app}/kiot-cua-toi/to-cao${r.ok ? '?da-gui=1' : `?loi=${r.error}`}`, 303);
  }
  const productId = String(form?.get('productId') ?? '');
  const r = form
    ? await submitFakeReport(user.id, {
        productId,
        reason: String(form.get('reason') ?? ''),
        text: String(form.get('text') ?? ''),
        orderId: String(form.get('orderId') ?? '') || null,
        images: await images(form),
      })
    : ({ ok: false, error: 'INVALID' } as const);
  return Response.redirect(
    `${app}/to-cao-hang-gia?sp=${encodeURIComponent(productId)}${r.ok ? `&da-gui=${r.reportId}` : `&loi=${r.error}`}`,
    303,
  );
}
