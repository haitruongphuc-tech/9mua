import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { listPins, removePin } from '@/lib/pins';

// Danh sách ghim để CEO xem (tên video/Kiot đi kèm). Thêm ghim đi qua creator.pinVideo / marketplace.pinKiot.
export async function pinsOverview() {
  const [videos, kiots] = await Promise.all([listPins('video'), listPins('kiot')]);
  const [vRows, kRows] = await Promise.all([
    db.video.findMany({
      where: { id: { in: videos.map((p) => p.targetId) } },
      select: { id: true, caption: true },
    }),
    db.kiot.findMany({
      where: { id: { in: kiots.map((p) => p.targetId) } },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  const caption = new Map(vRows.map((v) => [v.id, v.caption]));
  const kiot = new Map(kRows.map((k) => [k.id, k]));
  return {
    videos: videos.map((p) => ({ ...p, label: caption.get(p.targetId) || p.targetId })),
    kiots: kiots.map((p) => ({
      ...p,
      label: kiot.get(p.targetId)?.name ?? p.targetId,
      slug: kiot.get(p.targetId)?.slug,
    })),
    at: now(),
  };
}

export async function unpin(kind: 'video' | 'kiot', targetId: string, adminId: string): Promise<void> {
  await removePin(kind, targetId, adminId);
}
