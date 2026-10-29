import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { readPrivate, savePrivate } from '@/lib/media/private-store';
import { processImage } from '@/lib/media/process-image';
import { activeBan, isMember } from './access';
import { IMAGES_PER_HOUR, MAX_IMAGE_BYTES } from './rules';

export type ImageUploadError = 'TOO_LARGE' | 'NOT_AN_IMAGE' | 'TOO_MANY' | 'BANNED';

// Ảnh tin nhắn (SPEC-messages.md mục 4): ≤ 5 MB, chuyển WebP, bỏ thông tin vị trí; lưu riêng tư, không có URL công khai.
export async function saveMessageImage(
  userId: string,
  data: Buffer,
): Promise<{ ok: true; imageId: string } | { ok: false; error: ImageUploadError }> {
  if (data.length > MAX_IMAGE_BYTES) return { ok: false, error: 'TOO_LARGE' };
  if (await activeBan(userId)) return { ok: false, error: 'BANNED' };
  const at = now();
  const recent = await db.messageImage.count({
    where: { ownerId: userId, createdAt: { gt: new Date(at.getTime() - 3_600_000) } },
  });
  if (recent >= IMAGES_PER_HOUR) return { ok: false, error: 'TOO_MANY' };
  const img = await processImage(data);
  if (!img.ok) return { ok: false, error: img.error === 'TOO_LARGE' ? 'TOO_LARGE' : 'NOT_AN_IMAGE' };
  const fileKey = await savePrivate(`messages/${userId}/${randomBytes(12).toString('hex')}.webp`, img.main);
  const row = await db.messageImage.create({
    data: { ownerId: userId, fileKey, width: img.width, height: img.height, createdAt: at },
  });
  return { ok: true, imageId: row.id };
}

// Chỉ người tải lên, 2 thành viên cuộc trò chuyện chứa ảnh, hoặc CEO khi cuộc đó bị báo cáo mới mở được.
export async function readMessageImage(
  userId: string,
  imageId: string,
  opts: { admin?: boolean } = {},
): Promise<Buffer | null> {
  const image = await db.messageImage.findUnique({ where: { id: imageId } });
  if (!image) return null;
  let allowed = image.ownerId === userId;
  if (!allowed) {
    const msg = await db.message.findFirst({ where: { imageId }, select: { conversationId: true } });
    const c = msg ? await db.conversation.findUnique({ where: { id: msg.conversationId } }) : null;
    if (c && isMember(c, userId)) allowed = true;
    else if (c && opts.admin)
      allowed = (await db.messageReport.count({ where: { conversationId: c.id } })) > 0;
  }
  return allowed ? readPrivate(image.fileKey) : null;
}
