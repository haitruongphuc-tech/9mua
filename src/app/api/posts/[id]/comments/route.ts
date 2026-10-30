import { getT } from '@/i18n/server';
import { featureGuard } from '@/lib/features';
import { addPostComment, listPostComments } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// Bình luận bài viết (SPEC-creator.md V5.10 mục 3): như bình luận video (≤ 300 ký tự, không link, 10 giây một lần).
export async function GET(_request: Request, { params }: Ctx) {
  const off = await featureGuard('posts');
  if (off) return off;
  const user = await getCurrentUser();
  return Response.json(
    { items: await listPostComments((await params).id, user?.id) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request, { params }: Ctx) {
  const off = await featureGuard('posts');
  if (off) return off;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('feed.share.err.LOGIN') }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const r = await addPostComment(user.id, (await params).id, typeof body?.text === 'string' ? body.text : '');
  return r.ok
    ? Response.json(r)
    : Response.json({ ok: false, message: t(`feed.post.err.${r.error}`) }, { status: 400 });
}
