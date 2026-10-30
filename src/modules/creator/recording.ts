import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { runTool } from '@/lib/media/run-tool';
import { videoLimits } from './limits';
import { probe } from './transcode';
import { newUploadTarget } from './upload';

// Quay trong app (SPEC-creator.md V5.5 mục 1): mỗi lần giữ nút là một đoạn (MediaRecorder: WebM trên Chrome/Android,
// MP4 trên Safari). Máy chủ đổi tốc độ từng đoạn (tiếng đổi theo, giữ cao độ), đưa về 720×1280 rồi nối thành một file
// tải lên như đường chọn file — sau đó createVideoUpload và worker xử lý như mọi video.
export const SPEEDS = [0.5, 1, 2, 3] as const;
export const MAX_SEGMENTS = 20;
const STEP_TIMEOUT_MS = 3 * 60_000;

export type AssembleResult =
  { ok: true; uploadId: string } | { ok: false; error: 'INVALID' | 'BAD_FORMAT' | 'TOO_LONG' };

// atempo nhận 0,5–2: 3x = 1,5 × 2.
const atempo = (speed: number) => (speed === 3 ? 'atempo=1.5,atempo=2' : `atempo=${speed}`);

export async function assembleRecording(
  userId: string,
  segments: { path: string; speed: number }[],
): Promise<AssembleResult> {
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) return { ok: false, error: 'INVALID' };
  if (segments.some((s) => !SPEEDS.includes(s.speed as (typeof SPEEDS)[number])))
    return { ok: false, error: 'INVALID' };
  const limits = await videoLimits();
  // WebM của MediaRecorder thường không ghi thời lượng ở đầu file: thời lượng thật đo sau khi chuyển từng đoạn.
  const probes = await Promise.all(segments.map((s) => probe(s.path).catch(() => null)));
  if (probes.some((p) => !p?.video)) return { ok: false, error: 'BAD_FORMAT' };
  const cap = limits.maxSec + 1; // mỗi đoạn ra tối đa chừng này giây: không bao giờ ghi vô hạn

  const work = path.join(env().PRIVATE_DIR, 'recording-work', randomBytes(8).toString('hex'));
  await mkdir(work, { recursive: true });
  try {
    const parts: string[] = [];
    let total = 0;
    for (const [i, s] of segments.entries()) {
      const out = path.join(work, `part-${i}.mp4`);
      const hasAudio = probes[i]!.hasAudio;
      const known = probes[i]!.durationSec > 0 ? probes[i]!.durationSec : cap * s.speed;
      const video = `[0:v]setpts=PTS/${s.speed},scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v]`;
      const audio = `[${hasAudio ? '0:a:0' : '1:a'}]${atempo(s.speed)},aresample=44100[a]`;
      await runTool(
        'ffmpeg',
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          s.path,
          // Đoạn không có tiếng (micro bị chặn): thêm im lặng để nối các đoạn cùng định dạng.
          // Giới hạn đúng thời lượng đoạn: luồng im lặng không có điểm dừng sẽ ghi mãi tới đầy ổ.
          ...(hasAudio ? [] : ['-f', 'lavfi', '-t', known.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo']),
          '-filter_complex',
          `${video};${audio}`,
          '-map',
          '[v]',
          '-map',
          '[a]',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '20',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ac',
          '2',
          '-shortest',
          '-t',
          String(cap),
          '-map_metadata',
          '-1',
          '-f',
          'mp4',
          out,
        ],
        STEP_TIMEOUT_MS,
      );
      parts.push(out);
      total += (await probe(out)).durationSec;
      if (total > limits.maxSec + 0.5) return { ok: false, error: 'TOO_LONG' };
    }
    const list = path.join(work, 'list.txt');
    await writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    const { uploadId, target } = await newUploadTarget(userId);
    await runTool(
      'ffmpeg',
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        list,
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        target,
      ],
      STEP_TIMEOUT_MS,
    );
    return { ok: true, uploadId };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
