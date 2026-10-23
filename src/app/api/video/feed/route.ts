import { readAnonId } from '@/lib/anon-id';
import { getFeed } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get('sau') ?? undefined;
  const user = await getCurrentUser();
  const page = await getFeed({ userId: user?.id, anonId: await readAnonId() }, cursor);
  return Response.json(page, { headers: { 'Cache-Control': 'private, no-store' } });
}
