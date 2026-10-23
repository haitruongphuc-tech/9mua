import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { processImage, type ImageError } from '@/lib/media/process-image';
import { PROVINCES } from './provinces';

const PROVINCE_SLUGS = PROVINCES.map((p) => p.slug) as [string, ...string[]];
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null);

const addressInput = z.object({
  province: z.enum(PROVINCE_SLUGS, 'Chọn tỉnh/thành'),
  district: optionalText(60, 'Quận/huyện tối đa 60 ký tự'),
  addressLine: optionalText(200, 'Địa chỉ tối đa 200 ký tự'),
});

type AddressField = keyof z.input<typeof addressInput>;

// Địa chỉ lấy hàng (SPEC-kiot.md mục 2). Chỉ tỉnh và quận hiện công khai; địa chỉ chi tiết giữ riêng.
export async function updateKiotAddress(
  userId: string,
  raw: { province: string; district: string; addressLine: string },
): Promise<
  | { ok: true }
  | { ok: false; error: 'NO_KIOT' }
  | { ok: false; error: 'INVALID_INPUT'; fields: Partial<Record<AddressField, string>> }
> {
  const parsed = addressInput.safeParse(raw);
  if (!parsed.success) {
    const fields: Partial<Record<AddressField, string>> = {};
    for (const i of parsed.error.issues) fields[i.path[0] as AddressField] ??= i.message;
    return { ok: false, error: 'INVALID_INPUT', fields };
  }
  const updated = await db.kiot.updateMany({ where: { ownerId: userId }, data: parsed.data });
  return updated.count === 1 ? { ok: true } : { ok: false, error: 'NO_KIOT' };
}

export type KiotImageKind = 'logo' | 'cover';

// Logo dùng bản 400px, ảnh bìa dùng bản 1200px. Ảnh cũ được xoá sau khi ảnh mới đã lưu.
export async function setKiotImage(
  userId: string,
  kind: KiotImageKind,
  data: Buffer,
): Promise<{ ok: true; url: string } | { ok: false; error: 'NO_KIOT' | ImageError }> {
  const kiot = await db.kiot.findUnique({
    where: { ownerId: userId },
    select: { id: true, logoUrl: true, coverUrl: true },
  });
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  const processed = await processImage(data);
  if (!processed.ok) return processed;
  const t = now();
  const key = `kiots/${kiot.id}/${kind}-${t.getTime()}-${randomBytes(6).toString('base64url')}.webp`;
  const store = imageStore();
  const url = await store.save(key, kind === 'logo' ? processed.thumb : processed.main);
  await db.kiot.update({
    where: { id: kiot.id },
    data: kind === 'logo' ? { logoUrl: url } : { coverUrl: url },
  });
  const old = kind === 'logo' ? kiot.logoUrl : kiot.coverUrl;
  if (old) await store.remove(old);
  return { ok: true, url };
}

export async function removeKiotImage(userId: string, kind: KiotImageKind): Promise<void> {
  const kiot = await db.kiot.findUnique({
    where: { ownerId: userId },
    select: { id: true, logoUrl: true, coverUrl: true },
  });
  if (!kiot) return;
  const old = kind === 'logo' ? kiot.logoUrl : kiot.coverUrl;
  await db.kiot.update({
    where: { id: kiot.id },
    data: kind === 'logo' ? { logoUrl: null } : { coverUrl: null },
  });
  if (old) await imageStore().remove(old);
}
