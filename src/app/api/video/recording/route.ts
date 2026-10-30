import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { featureGuard } from '@/lib/features';
import { assembleRecording, MAX_SEGMENTS } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

// Đoạn quay trong app chỉ dài vài chục giây: giới hạn 200MB cho cả lần gửi (không mở 2GB như video dài).
const MAX_BODY = 200 * 1024 * 1024;

// Nhận các đoạn quay (s0, s1, …) và tốc độ từng đoạn, ghép thành 1 file tải lên (SPEC-creator.md V5.5 mục 1).
export async function POST(request: Request) {
  const off = await featureGuard('camera');
  if (off) return off;
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, message: t('seller.err.login') }, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
    return Response.json({ ok: false, message: t('post.err.TOO_LARGE') }, { status: 413 });
  const form = await request.formData().catch(() => null);
  let speeds: unknown;
  try {
    speeds = JSON.parse(String(form?.get('speeds') ?? '[]'));
  } catch {
    speeds = null;
  }
  if (!form || !Array.isArray(speeds) || speeds.length === 0 || speeds.length > MAX_SEGMENTS)
    return Response.json({ ok: false, message: t('post.err.BAD_FORMAT') }, { status: 400 });
  const dir = path.join(env().PRIVATE_DIR, 'recording-in', randomBytes(8).toString('hex'));
  await mkdir(dir, { recursive: true });
  try {
    const segments: { path: string; speed: number }[] = [];
    for (const [i, speed] of speeds.entries()) {
      const file = form.get(`s${i}`);
      if (!(file instanceof File))
        return Response.json({ ok: false, message: t('post.err.BAD_FORMAT') }, { status: 400 });
      const target = path.join(dir, `${i}.bin`);
      await pipeline(Readable.fromWeb(file.stream() as unknown as NodeWebStream), createWriteStream(target));
      segments.push({ path: target, speed: Number(speed) });
    }
    const result = await assembleRecording(user.id, segments);
    if (!result.ok) {
      const key = result.error === 'TOO_LONG' ? 'post.err.TOO_LONG' : 'post.err.BAD_FORMAT';
      return Response.json({ ok: false, message: t(key) }, { status: 400 });
    }
    return Response.json({ ok: true, uploadId: result.uploadId });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
