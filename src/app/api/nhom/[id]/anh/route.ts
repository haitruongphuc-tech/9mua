import { featureGuard } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { setGroupAvatar } from '@/modules/social';

export const dynamic = 'force-dynamic';

const MAX_BODY = 10.5 * 1024 * 1024;

// Ảnh nhóm (SPEC-social.md V5.10 mục 1). Form gửi thẳng tới đây (server action chỉ nhận 1MB).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await featureGuard('groups');
  if (off) return off;
  const user = await getCurrentUser();
  if (!user) return new Response('Not found', { status: 404 });
  const { id } = await params;
  const form =
    Number(request.headers.get('content-length') ?? 0) > MAX_BODY
      ? null
      : await request.formData().catch(() => null);
  const file = form?.get('file');
  const r =
    file instanceof File && file.size > 0
      ? await setGroupAvatar(user.id, id, Buffer.from(await file.arrayBuffer()))
      : { ok: false };
  return Response.redirect(
    new URL(`/nhom/${encodeURIComponent(id)}/quan-tri${r.ok ? '' : '?loi=anh'}`, request.url),
    303,
  );
}
