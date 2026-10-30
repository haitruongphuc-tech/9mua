import { featureGuard } from '@/lib/features';
import { listSounds, type SoundView } from '@/modules/creator';

export const dynamic = 'force-dynamic';

export type SoundItem = SoundView;

// Âm thanh thịnh hành 7 ngày, hoặc tìm theo tên (?q=) — bảng chọn nhạc khi đăng video (SPEC-creator.md V5.6 mục 2).
export async function GET(request: Request) {
  const off = await featureGuard('camera');
  if (off) return off;
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return Response.json({ items: await listSounds(q) });
}
