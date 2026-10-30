import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { runTool as run } from '@/lib/media/run-tool';
import { trimArgs, type Trim } from './transcode';

// Nhiều mức chất lượng (SPEC-creator.md V5.1 mục 5–7, công tắc long_video). Tham số ffmpeg là mảng cố định, không qua
// shell; đường dẫn do hệ thống tự đặt.
export const HLS_SEGMENT_SEC = 6;
const HLS_LEVELS = [360, 480, 720] as const;
const BITRATE: Record<number, number> = { 360: 700, 480: 1200, 720: 2500, 1080: 5000 }; // kbps
const BASE = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y'];
const STEP_TIMEOUT_MS = 60_000;

// Thu nhỏ theo cạnh ngắn (dọc 9:16 hay ngang 16:9 đều ra đúng "480p"), giữ tỉ lệ, số chẵn.
const scaleShort = (h: number) => `scale=w='if(gte(iw,ih),-2,${h})':h='if(gte(iw,ih),${h},-2)'`;

// Các mức HLS theo độ phân giải gốc: không phóng to; 1080p chỉ khi gốc ≥ 1080p và CEO bật video_enable_1080.
export function hlsLevels(source: { width: number; height: number }, enable1080: boolean): number[] {
  const short = Math.min(source.width, source.height);
  const levels: number[] = HLS_LEVELS.filter((h) => h <= Math.max(short, HLS_LEVELS[0]));
  if (enable1080 && short >= 1080) levels.push(1080);
  return levels;
}

export function hlsArgs(
  src: string,
  outDir: string,
  levels: number[],
  hasAudio: boolean,
  maxSec: number,
  look: string | null = null,
  trim: Trim | null = null,
): string[] {
  const filter =
    `[0:v]${look ? `${look},` : ''}split=${levels.length}${levels.map((_, i) => `[s${i}]`).join('')};` +
    levels.map((h, i) => `[s${i}]${scaleShort(h)}[v${i}]`).join(';');
  const args = [...BASE, ...trimArgs(trim), '-i', src, '-filter_complex', filter];
  levels.forEach((h, i) => {
    const kbps = BITRATE[h]!;
    args.push(
      '-map',
      `[v${i}]`,
      `-c:v:${i}`,
      'libx264',
      `-b:v:${i}`,
      `${kbps}k`,
      `-maxrate:v:${i}`,
      `${Math.round(kbps * 1.2)}k`,
      `-bufsize:v:${i}`,
      `${kbps * 2}k`,
    );
  });
  if (hasAudio) for (let i = 0; i < levels.length; i++) args.push('-map', '0:a:0');
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
  args.push(
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    // Khung khoá đúng mỗi 6 giây để các mức chuyển qua lại không giật.
    '-force_key_frames',
    `expr:gte(t,n_forced*${HLS_SEGMENT_SEC})`,
    '-sc_threshold',
    '0',
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-t',
    String(maxSec + 1),
    '-f',
    'hls',
    '-hls_time',
    String(HLS_SEGMENT_SEC),
    '-hls_playlist_type',
    'vod',
    '-hls_flags',
    'independent_segments',
    // Đoạn fMP4 (.m4s): Safari và hls.js đều phát; không dùng .ts (trùng đuôi file TypeScript).
    '-hls_segment_type',
    'fmp4',
    '-hls_fmp4_init_filename',
    'init.mp4', // nhiều mức: ffmpeg đặt init_0.mp4, init_1.mp4… (đọc tên thật bằng hlsInitFile)
    '-hls_segment_filename',
    path.join(outDir, '%v', 'seg%04d.m4s'),
    '-master_pl_name',
    'master.m3u8',
    '-var_stream_map',
    levels.map((h, i) => (hasAudio ? `v:${i},a:${i},name:${h}p` : `v:${i},name:${h}p`)).join(' '),
    path.join(outDir, '%v', 'index.m3u8'),
  );
  return args;
}

export async function makeHls(
  src: string,
  outDir: string,
  levels: number[],
  hasAudio: boolean,
  maxSec: number,
  timeoutMs: number,
  look: string | null = null,
  trim: Trim | null = null,
): Promise<void> {
  await run('ffmpeg', hlsArgs(src, outDir, levels, hasAudio, maxSec, look, trim), timeoutMs);
}

// Tên file init của một mức: 1 mức thì "init.mp4", nhiều mức thì "init_<thứ tự>.mp4" — đọc từ dòng EXT-X-MAP.
export async function hlsInitFile(levelDir: string): Promise<string> {
  const playlist = await readFile(path.join(levelDir, 'index.m3u8'), 'utf8');
  const name = /#EXT-X-MAP:URI="([\w.-]+)"/.exec(playlist)?.[1];
  if (!name) throw new Error('Playlist HLS thiếu EXT-X-MAP');
  return path.join(levelDir, name);
}

// Bản MP4 480p cho video ≤ 60 giây, làm từ bản 720p đã chuyển mã: vừa khung 480×854 (bản 720p vừa khung 720×1280).
export const SD_BOX = { width: 480, height: 854 } as const;

export async function makeMp4Sd(src: string, out: string): Promise<void> {
  await run(
    'ffmpeg',
    [
      ...BASE,
      '-i',
      src,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-vf',
      `scale=w='min(${SD_BOX.width},iw)':h='min(${SD_BOX.height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-ac',
      '2',
      '-map_metadata',
      '-1',
      '-movflags',
      '+faststart',
      '-f',
      'mp4',
      out,
    ],
    5 * 60_000,
  );
}

export const COVER_POINTS = [0.1, 0.5, 0.9] as const;

// 3 ảnh bìa gợi ý ở 10%, 50%, 90% thời lượng.
export async function makeCovers(src: string, outDir: string, durationSec: number): Promise<string[]> {
  const files: string[] = [];
  for (const [i, point] of COVER_POINTS.entries()) {
    const out = path.join(outDir, `cover-${i + 1}.jpg`);
    await run(
      'ffmpeg',
      [
        ...BASE,
        '-ss',
        (durationSec * point).toFixed(2),
        '-i',
        src,
        '-frames:v',
        '1',
        '-q:v',
        '3',
        '-map_metadata',
        '-1',
        '-f',
        'image2',
        out,
      ],
      STEP_TIMEOUT_MS,
    );
    files.push(out);
  }
  return files;
}

// Ảnh xem trước động: WebP 3 giây, rộng 240px, lấy ở giữa video.
export async function makePreview(src: string, out: string, durationSec: number): Promise<void> {
  const length = Math.min(3, durationSec);
  await run(
    'ffmpeg',
    [
      ...BASE,
      '-ss',
      Math.max(0, durationSec / 2 - length / 2).toFixed(2),
      '-t',
      length.toFixed(2),
      '-i',
      src,
      '-an',
      '-vf',
      'fps=8,scale=240:-2',
      '-c:v',
      'libwebp_anim',
      '-quality',
      '60',
      '-loop',
      '0',
      '-map_metadata',
      '-1',
      '-f',
      'webp',
      out,
    ],
    STEP_TIMEOUT_MS,
  );
}

// Mọi file trong thư mục (đệ quy), đường dẫn tương đối, để lưu cả thư mục HLS.
export async function listFiles(dir: string, prefix = ''): Promise<{ rel: string; bytes: number }[]> {
  const out: { rel: string; bytes: number }[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listFiles(path.join(dir, entry.name), rel)));
    else out.push({ rel, bytes: (await stat(path.join(dir, entry.name))).size });
  }
  return out;
}
