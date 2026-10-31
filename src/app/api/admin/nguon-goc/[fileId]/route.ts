import { readOriginFile } from '@/modules/kiot';
import { getVerifiedAdmin } from '@/modules/admin';

export const dynamic = 'force-dynamic';

// File hồ sơ nguồn gốc: chỉ admin đã xác minh xem được (SPEC-kiot.md V5.2 mục 2). Không cache, không công khai.
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  if (!(await getVerifiedAdmin())) return new Response('Not found', { status: 404 });
  const f = await readOriginFile((await params).fileId);
  if (!f) return new Response('Not found', { status: 404 });
  const type = f.pdf ? 'application/pdf' : f.kind === 'video' ? 'video/mp4' : 'image/webp';
  return new Response(new Uint8Array(f.data), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
