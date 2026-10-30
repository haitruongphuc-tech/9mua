import { Prisma, type Kiot } from '@prisma/client';
import { z } from 'zod';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { hasCurrentCommitment, normalizeIdentifier } from '@/modules/identity';
import { validateSlug, type SlugCheck } from './slug';

export type KiotStatus = 'draft' | 'active' | 'expired' | 'locked';

// Không lưu cứng active/expired: tính từ activeUntil nên không cần tác vụ định kỳ (SPEC-kiot.md).
export function kiotStatus(kiot: Pick<Kiot, 'activeUntil' | 'lockedAt'>, at: Date = now()): KiotStatus {
  if (kiot.lockedAt) return 'locked';
  if (!kiot.activeUntil) return 'draft';
  return kiot.activeUntil > at ? 'active' : 'expired';
}

export function isKiotActive(kiot: Pick<Kiot, 'activeUntil' | 'lockedAt'>, at: Date = now()): boolean {
  return kiotStatus(kiot, at) === 'active';
}

const kiotInput = z.object({
  name: z.string().trim().min(2, 'Tên Kiot cần ít nhất 2 ký tự').max(60, 'Tên Kiot tối đa 60 ký tự'),
  slug: z.string().trim(),
  description: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự').default(''),
  contactPhone: z.string(),
});

export type KiotInput = z.input<typeof kiotInput>;
type Field = 'name' | 'slug' | 'description' | 'contactPhone';
type InvalidInput = { ok: false; error: 'INVALID_INPUT'; fields: Partial<Record<Field, string>> };
type SlugError = { ok: false; error: 'SLUG_INVALID' | 'SLUG_RESERVED' | 'SLUG_TAKEN' };

function parseInput(raw: KiotInput) {
  const parsed = kiotInput.safeParse(raw);
  const fields: Partial<Record<Field, string>> = {};
  if (!parsed.success) for (const i of parsed.error.issues) fields[i.path[0] as Field] ??= i.message;
  const phone = normalizeIdentifier(raw.contactPhone ?? '');
  if (phone?.kind !== 'phone') fields.contactPhone ??= 'Số điện thoại liên hệ không hợp lệ';
  if (!parsed.success || phone?.kind !== 'phone')
    return { ok: false as const, error: 'INVALID_INPUT' as const, fields };
  return { ok: true as const, data: { ...parsed.data, contactPhone: phone.value } };
}

const isUniqueViolation = (e: unknown, field: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === 'P2002' &&
  JSON.stringify(e.meta?.target ?? '').includes(field);

export async function isSlugAvailable(slug: string): Promise<SlugCheck | SlugError> {
  const check = validateSlug(slug);
  if (!check.ok) return check;
  const taken = await db.kiot.findUnique({ where: { slug }, select: { id: true } });
  return taken ? { ok: false, error: 'SLUG_TAKEN' } : { ok: true };
}

export async function createKiot(
  userId: string,
  raw: KiotInput,
): Promise<
  | { ok: true; kiotId: string }
  | { ok: false; error: 'ALREADY_HAS_KIOT' | 'COMMITMENT_REQUIRED' }
  | SlugError
  | InvalidInput
> {
  // Phải đồng ý cam kết nội dung bản mới nhất (SPEC-identity.md V5.6).
  if (!(await hasCurrentCommitment(userId))) return { ok: false, error: 'COMMITMENT_REQUIRED' };
  const input = parseInput(raw);
  if (!input.ok) return input;
  const slugCheck = validateSlug(input.data.slug);
  if (!slugCheck.ok) return slugCheck;

  try {
    const kiot = await db.kiot.create({ data: { ...input.data, ownerId: userId } });
    return { ok: true, kiotId: kiot.id };
  } catch (error) {
    // Ràng buộc unique của DB quyết định khi hai người tạo cùng lúc.
    if (isUniqueViolation(error, 'ownerId')) return { ok: false, error: 'ALREADY_HAS_KIOT' };
    if (isUniqueViolation(error, 'slug')) return { ok: false, error: 'SLUG_TAKEN' };
    throw error;
  }
}

export async function updateKiot(
  userId: string,
  raw: KiotInput,
): Promise<{ ok: true } | { ok: false; error: 'NO_KIOT' | 'SLUG_LOCKED' } | SlugError | InvalidInput> {
  const kiot = await db.kiot.findUnique({ where: { ownerId: userId } });
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  const input = parseInput(raw);
  if (!input.ok) return input;

  if (input.data.slug !== kiot.slug) {
    // Đã từng kích hoạt thì slug cố định để link và QR đã in không hỏng.
    if (kiot.activeUntil) return { ok: false, error: 'SLUG_LOCKED' };
    const slugCheck = validateSlug(input.data.slug);
    if (!slugCheck.ok) return slugCheck;
  }

  try {
    // Điều kiện activeUntil=null khi đổi slug chặn trường hợp vừa kích hoạt giữa chừng.
    const where = input.data.slug !== kiot.slug ? { id: kiot.id, activeUntil: null } : { id: kiot.id };
    const updated = await db.kiot.updateMany({ where, data: input.data });
    if (updated.count === 0) return { ok: false, error: 'SLUG_LOCKED' };
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) return { ok: false, error: 'SLUG_TAKEN' };
    throw error;
  }
}

export function getKiotByOwner(userId: string): Promise<Kiot | null> {
  return db.kiot.findUnique({ where: { ownerId: userId } });
}

export function getKiotBySlug(slug: string): Promise<Kiot | null> {
  return db.kiot.findUnique({ where: { slug } });
}

const shippingInput = z.object({
  shippingFee: z
    .number()
    .int('Phí ship là số nguyên')
    .min(0, 'Phí ship không âm')
    .max(200_000, 'Phí ship tối đa 200.000đ'),
  freeShippingThreshold: z.number().int().positive('Ngưỡng miễn phí phải lớn hơn 0').nullable(),
});

// Phí ship cố định mỗi đơn và ngưỡng miễn phí ship (SPEC-orders.md mục 2).
export async function updateShipping(
  userId: string,
  raw: { shippingFee: number; freeShippingThreshold: number | null },
): Promise<
  { ok: true } | { ok: false; error: 'NO_KIOT' } | { ok: false; error: 'INVALID_INPUT'; message: string }
> {
  const parsed = shippingInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT', message: parsed.error.issues[0]!.message };
  const updated = await db.kiot.updateMany({ where: { ownerId: userId }, data: parsed.data });
  return updated.count ? { ok: true } : { ok: false, error: 'NO_KIOT' };
}
