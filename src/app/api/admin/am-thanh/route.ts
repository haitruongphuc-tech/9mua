import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { env } from '@/lib/env';
import { getVerifiedAdmin } from '@/modules/admin';
import { addLibrarySound, MAX_LIBRARY_BYTES } from '@/modules/creator';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  INVALID: 'Cần tên bài (tối đa 60 ký tự).',
  TOO_LARGE: 'File quá 10MB.',
  TOO_LONG: 'Nhạc dài quá 5 phút.',
  BAD_FORMAT: 'Không đọc được file. Chỉ nhận MP3 hoặc M4A có tiếng.',
} as const;

const back = (request: Request, ok: boolean, message: string) =>
  Response.redirect(
    new URL(`/admin/am-thanh?${ok ? 'xong' : 'loi'}=${encodeURIComponent(message)}`, request.url),
    303,
  );

// CEO tải nhạc lên thư viện âm thanh (SPEC-creator.md V5.6 mục 2): MP3/M4A ≤ 10MB, ≤ 5 phút. Form gửi thẳng tới đây
// (server action chỉ nhận 1MB).
export async function POST(request: Request) {
  const admin = await getVerifiedAdmin();
  if (!admin) return new Response('Not found', { status: 404 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_LIBRARY_BYTES + 64 * 1024)
    return back(request, false, MESSAGES.TOO_LARGE);
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!form || !(file instanceof File) || file.size === 0) return back(request, false, MESSAGES.BAD_FORMAT);
  const dir = path.join(env().PRIVATE_DIR, 'sound-in', randomBytes(8).toString('hex'));
  await mkdir(dir, { recursive: true });
  try {
    const target = path.join(dir, 'in.bin');
    await pipeline(Readable.fromWeb(file.stream() as unknown as NodeWebStream), createWriteStream(target));
    const r = await addLibrarySound(admin.id, {
      title: String(form.get('title') ?? ''),
      artist: String(form.get('artist') ?? ''),
      path: target,
      bytes: file.size,
    });
    return r.ok ? back(request, true, 'Đã thêm nhạc vào thư viện.') : back(request, false, MESSAGES[r.error]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
