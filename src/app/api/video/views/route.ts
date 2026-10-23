import { ensureAnonId } from '@/lib/anon-id';
import { recordViews } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Trình duyệt gửi lượt xem theo lô (sendBeacon) khi đã xem vài video hoặc khi rời trang.
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) return new Response(null, { status: 413 });
  let entries: { videoId: string; watchedSeconds: number }[] = [];
  try {
    const body = (await request.json()) as unknown;
    if (Array.isArray(body))
      entries = body
        .filter(
          (e): e is { videoId: string; watchedSeconds: number } =>
            typeof e?.videoId === 'string' && Number.isFinite(e?.watchedSeconds),
        )
        .slice(0, 50);
  } catch {
    return new Response(null, { status: 400 });
  }
  const user = await getCurrentUser();
  const counted = await recordViews(
    { userId: user?.id, anonId: user ? undefined : await ensureAnonId() },
    entries,
  );
  return Response.json({ counted });
}
