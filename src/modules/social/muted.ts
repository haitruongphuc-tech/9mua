import { now } from '@/lib/clock';
import { db } from '@/lib/db';

// Từ cấm (SPEC-social.md V5.4 mục 3): mỗi người tối đa 50 từ, mỗi từ ≤ 30 ký tự. Bình luận trên video / bài của mình có
// từ đó (không phân biệt dấu, hoa thường, khớp nguyên từ) tự ẩn; người viết vẫn thấy bình luận của mình.
export const MAX_MUTED = 50;
export const MAX_MUTED_CHARS = 30;

// Bỏ dấu, đ → d, chữ thường, mọi ký tự không phải chữ / số thành một khoảng trắng.
export function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Khớp nguyên từ (hoặc nguyên cụm nhiều từ) sau khi bỏ dấu.
export function containsMuted(text: string, folded: string[]): boolean {
  if (!folded.length) return false;
  const hay = ` ${foldText(text)} `;
  return folded.some((w) => w && hay.includes(` ${w} `));
}

export async function listMutedKeywords(userId: string): Promise<{ id: string; word: string }[]> {
  return db.mutedKeyword.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, word: true },
  });
}

export async function addMutedKeyword(
  userId: string,
  word: string,
): Promise<{ ok: true } | { ok: false; error: 'INVALID' | 'LIMIT' | 'DUPLICATE' }> {
  const clean = word.replace(/\s+/g, ' ').trim();
  const folded = foldText(clean);
  if (!folded || clean.length > MAX_MUTED_CHARS) return { ok: false, error: 'INVALID' };
  if ((await db.mutedKeyword.count({ where: { userId } })) >= MAX_MUTED) return { ok: false, error: 'LIMIT' };
  const created = await db.mutedKeyword
    .create({ data: { userId, word: clean, folded, createdAt: now() } })
    .catch(() => null);
  return created ? { ok: true } : { ok: false, error: 'DUPLICATE' };
}

export async function removeMutedKeyword(userId: string, id: string): Promise<void> {
  await db.mutedKeyword.deleteMany({ where: { id, userId } });
}

export async function mutedFolded(userId: string): Promise<string[]> {
  return (await db.mutedKeyword.findMany({ where: { userId }, select: { folded: true } })).map(
    (m) => m.folded,
  );
}
