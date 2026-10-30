import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { normalizeSearchText } from '@/lib/search-text';

// @tên người dùng (SPEC-identity.md V5.1): 3–24 ký tự a-z 0-9 . _, không chấm ở đầu/cuối, không 2 chấm liền nhau, không
// trùng từ dành riêng (đường dẫn của web, tên dễ giả mạo 9MUA/CEO).
export const RESERVED_HANDLES = [
  'admin',
  'administrator',
  '9mua',
  '9mua.com',
  'ceo',
  'live',
  'video',
  'videos',
  'cho',
  'kiot',
  'kiots',
  'api',
  'watch',
  'nhom',
  'su-kien',
  'sukien',
  'tim-kiem',
  'timkiem',
  'dang-nhap',
  'dang-ky',
  'tai-khoan',
  'taikhoan',
  'hop-thu',
  'hopthu',
  'thong-bao',
  'gio-hang',
  'dat-hang',
  'don-mua',
  'creator',
  'hashtag',
  'uploads',
  'am-thanh',
  'nhung',
  'huong-dan',
  'cam-ket',
  'kiem-duyet',
  'phap-ly',
  'chinh-sach',
  'gioi-thieu',
  'support',
  'hotro',
  'help',
  'root',
  'system',
  'null',
  'undefined',
  'me',
  'toi',
  'settings',
  'caidat',
  'mod',
  'moderator',
  'staff',
  'official',
  'www',
  'mail',
] as const;

const RESERVED = new Set<string>(RESERVED_HANDLES);
const CHANGE_EVERY_MS = 30 * 86_400_000;
const KEEP_OLD_MS = 30 * 86_400_000;

export function validateHandle(handle: string): 'INVALID' | 'RESERVED' | null {
  if (handle.length < 3 || handle.length > 24 || !/^[a-z0-9._]+$/.test(handle)) return 'INVALID';
  if (handle.startsWith('.') || handle.endsWith('.') || handle.includes('..')) return 'INVALID';
  return RESERVED.has(handle) ? 'RESERVED' : null;
}

// Tên tự đặt: tên hiển thị bỏ dấu, viết liền, tối đa 20 ký tự (chừa chỗ thêm 4 số khi trùng).
export function handleFromName(displayName: string): string {
  const base = normalizeSearchText(displayName).replace(/[^a-z0-9]/g, '');
  return (base.length >= 3 ? base : `${base}user`).slice(0, 20);
}

// @tên còn trống: không ai đang dùng, và không phải @tên cũ của người khác còn trong 30 ngày giữ.
async function isFree(handle: string, exceptUserId?: string): Promise<boolean> {
  const taken = await db.user.findFirst({
    where: {
      id: exceptUserId ? { not: exceptUserId } : undefined,
      OR: [{ handle }, { previousHandle: handle, previousHandleUntil: { gt: now() } }],
    },
    select: { id: true },
  });
  return !taken;
}

// @tên cũ đã hết 30 ngày giữ thì gỡ, để cột duy nhất previousHandle không chặn người khác dùng lại.
async function releaseExpired(handle: string): Promise<void> {
  await db.user.updateMany({
    where: { previousHandle: handle, previousHandleUntil: { lte: now() } },
    data: { previousHandle: null, previousHandleUntil: null },
  });
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

// Trả @tên của người dùng, tự đặt nếu chưa có (tài khoản cũ hoặc mới tạo). null nếu không có người dùng.
export async function ensureHandle(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { handle: true, displayName: true },
  });
  if (!user) return null;
  if (user.handle) return user.handle;
  const base = handleFromName(user.displayName);
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${randomInt(1000, 10000)}`;
    if (validateHandle(candidate) || !(await isFree(candidate))) continue;
    await releaseExpired(candidate);
    try {
      const set = await db.user.updateMany({
        where: { id: userId, handle: null },
        data: { handle: candidate },
      });
      if (set.count === 1) return candidate;
      return (await db.user.findUnique({ where: { id: userId }, select: { handle: true } }))?.handle ?? null;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error('Không đặt được @tên tự động');
}

// Đặt @tên cho các tài khoản chưa có (chạy theo lô trong việc định kỳ). Trả số tài khoản đã đặt.
export async function assignMissingHandles(limit: number): Promise<number> {
  const rows = await db.user.findMany({
    where: { handle: null },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  for (const r of rows) await ensureHandle(r.id);
  return rows.length;
}

export type SetHandleResult =
  { ok: true } | { ok: false; error: 'INVALID' | 'TAKEN' | 'RESERVED' | 'TOO_SOON' };

// Đổi @tên: 30 ngày một lần (lần đầu đổi tên tự đặt thì được ngay). @tên cũ giữ 30 ngày và chuyển hướng sang tên mới.
export async function setHandle(userId: string, raw: string): Promise<SetHandleResult> {
  const handle = raw.trim().replace(/^@/, '');
  const invalid = validateHandle(handle);
  if (invalid) return { ok: false, error: invalid };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { handle: true, handleChangedAt: true, previousHandle: true },
  });
  if (!user) return { ok: false, error: 'INVALID' };
  if (user.handle === handle) return { ok: true };
  const t = now();
  if (user.handleChangedAt && t.getTime() - user.handleChangedAt.getTime() < CHANGE_EVERY_MS)
    return { ok: false, error: 'TOO_SOON' };
  if (!(await isFree(handle, userId))) return { ok: false, error: 'TAKEN' };
  await releaseExpired(handle);
  if (user.handle) await releaseExpired(user.handle);
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        handle,
        handleChangedAt: t,
        // Lấy lại đúng @tên cũ của mình thì không cần giữ tên nào nữa.
        previousHandle: user.handle && user.handle !== handle ? user.handle : null,
        previousHandleUntil: user.handle ? new Date(t.getTime() + KEEP_OLD_MS) : null,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'TAKEN' };
    throw e;
  }
  return { ok: true };
}

// Trang /@<tên>: @tên hiện tại → userId; @tên cũ trong 30 ngày → chuyển hướng sang tên mới. Tài khoản khoá thì không có.
export async function resolveHandle(
  raw: string,
): Promise<{ userId: string } | { redirectTo: string } | null> {
  const handle = decodeURIComponent(raw).trim().replace(/^@/, '').toLowerCase();
  if (validateHandle(handle) === 'INVALID') return null;
  const current = await db.user.findUnique({ where: { handle }, select: { id: true, lockedAt: true } });
  if (current) return current.lockedAt ? null : { userId: current.id };
  const old = await db.user.findFirst({
    where: { previousHandle: handle, previousHandleUntil: { gt: now() }, lockedAt: null },
    select: { handle: true },
  });
  return old?.handle ? { redirectTo: old.handle } : null;
}

// @tên còn được đổi lúc nào (null = đổi được ngay), để trang Cài đặt báo trước.
export async function handleInfo(
  userId: string,
): Promise<{ handle: string | null; nextChangeAt: Date | null } | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { handleChangedAt: true } });
  if (!user) return null;
  const handle = await ensureHandle(userId);
  const next = user.handleChangedAt ? new Date(user.handleChangedAt.getTime() + CHANGE_EVERY_MS) : null;
  return { handle, nextChangeAt: next && next > now() ? next : null };
}
