import { reportVideo } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: 'LOGIN_REQUIRED' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    videoId?: unknown;
    reason?: unknown;
    message?: unknown;
  };
  if (typeof body.videoId !== 'string') return Response.json({ ok: false }, { status: 400 });
  const result = await reportVideo(
    user.id,
    body.videoId,
    String(body.reason ?? ''),
    String(body.message ?? ''),
  );
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
