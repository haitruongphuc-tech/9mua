import { env } from '@/lib/env';
import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { submitOrigin } from '@/modules/kiot';

export const dynamic = 'force-dynamic';

const MAX_BODY = 130 * 1024 * 1024;
const buf = async (f: File) => Buffer.from(await f.arrayBuffer());
const filesOf = (form: FormData | null, name: string) =>
  (form?.getAll(name) ?? []).filter((f): f is File => f instanceof File && f.size > 0);

// Nộp hồ sơ nguồn gốc (SPEC-kiot.md V5.2). Form gửi thẳng tới đây vì có nhiều file (server action chỉ nhận 1MB).
export async function POST(request: Request) {
  const off = await featureGuard('origin');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const form =
    Number(request.headers.get('content-length') ?? 0) > MAX_BODY
      ? null
      : await request.formData().catch(() => null);
  const video = filesOf(form, 'video')[0];
  const r = form
    ? await submitOrigin(user.id, {
        documents: [
          ...(await Promise.all(
            filesOf(form, 'invoice').map(async (f) => ({ kind: 'invoice' as const, data: await buf(f) })),
          )),
          ...(await Promise.all(
            filesOf(form, 'certificate').map(async (f) => ({
              kind: 'certificate' as const,
              data: await buf(f),
            })),
          )),
        ],
        photos: await Promise.all(filesOf(form, 'photos').map(buf)),
        video: video ? await buf(video) : null,
        commitOrigin: form.get('commitOrigin') === 'on',
        commitRefund: form.get('commitRefund') === 'on',
      })
    : { ok: false as const, error: 'FILE_INVALID' as const };
  return Response.redirect(
    `${env().APP_URL}/kiot-cua-toi/nguon-goc${r.ok ? '?da-gui=1' : `?loi=${r.error}`}`,
    303,
  );
}
