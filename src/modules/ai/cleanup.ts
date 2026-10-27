import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';

// Ảnh và video AI chưa đăng bán tự xoá sau 7 ngày (SPEC-ai.md "Dữ liệu"). Ảnh đã đăng bán là bản chép riêng trong
// ảnh sản phẩm nên không bị ảnh hưởng. Worker gọi mỗi giờ. Trả về số ảnh đã xoá.
export const AI_FILE_DAYS = 7;

export async function cleanupAiFiles(): Promise<number> {
  const before = new Date(now().getTime() - AI_FILE_DAYS * 86_400_000);
  const store = imageStore();
  const images = await db.aiImage.findMany({ where: { createdAt: { lt: before } }, take: 500 });
  for (const img of images) await Promise.all([store.remove(img.url), store.remove(img.thumbUrl)]);
  if (images.length) await db.aiImage.deleteMany({ where: { id: { in: images.map((i) => i.id) } } });
  const slides = await db.aiSlideshow.findMany({ where: { createdAt: { lt: before } }, take: 500 });
  for (const s of slides) if (s.url) await store.remove(s.url);
  if (slides.length) await db.aiSlideshow.deleteMany({ where: { id: { in: slides.map((s) => s.id) } } });
  return images.length;
}
