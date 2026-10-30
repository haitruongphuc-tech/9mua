import { runTool as run, ToolError } from '@/lib/media/run-tool';

// Chạy ffprobe/ffmpeg bằng spawn với MẢNG tham số cố định (không qua shell, không ghép chuỗi lệnh từ dữ liệu
// người dùng — SPEC-creator.md "Không bao giờ"). Đường dẫn file do hệ thống tự đặt.
export const MAX_DURATION_SEC = 60;
export const MAX_STORY_SEC = 30; // Story 24 giờ (SPEC-creator.md bổ sung 27/10)
export const TRANSCODE_TIMEOUT_MS = 5 * 60_000;
export const LONG_TRANSCODE_TIMEOUT_MS = 3 * 3_600_000; // video dài xử lý quá 3 giờ thì failed (SPEC-creator.md V5.1)
const PROBE_TIMEOUT_MS = 30_000;

export { ToolError };

// Cắt đầu/cuối (SPEC-creator.md V5.6 mục 1): tua tới giây bắt đầu và chỉ đọc đúng độ dài, trước khi chuyển mã.
export type Trim = { start: number; len: number | null };
export const trimArgs = (trim: Trim | null | undefined): string[] =>
  trim ? ['-ss', trim.start.toFixed(3), ...(trim.len ? ['-t', trim.len.toFixed(3)] : [])] : [];

export type Probe = {
  formatName: string;
  durationSec: number;
  video: { codec: string; width: number; height: number } | null;
  hasAudio: boolean;
  tags: Record<string, string>;
};

type RawProbe = {
  format?: { format_name?: string; duration?: string; tags?: Record<string, string> };
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
};

export async function probe(path: string): Promise<Probe> {
  const { stdout } = await run(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '--', path],
    PROBE_TIMEOUT_MS,
  );
  const raw = JSON.parse(stdout) as RawProbe;
  const v = raw.streams?.find((s) => s.codec_type === 'video');
  return {
    formatName: raw.format?.format_name ?? '',
    durationSec: Number(raw.format?.duration ?? 0),
    video: v ? { codec: v.codec_name ?? '', width: v.width ?? 0, height: v.height ?? 0 } : null,
    hasAudio: Boolean(raw.streams?.some((s) => s.codec_type === 'audio')),
    tags: raw.format?.tags ?? {},
  };
}

const ACCEPTED_FORMATS = ['mov', 'mp4', 'matroska', 'webm'];

// Lý do không nhận video (hiển thị cho người đăng), hoặc null nếu dùng được. avi: nhận thêm AVI khi bật video dài.
export function rejectReason(p: Probe, maxSec: number = MAX_DURATION_SEC, avi = false): string | null {
  const formats = avi ? [...ACCEPTED_FORMATS, 'avi'] : ACCEPTED_FORMATS;
  if (!formats.some((f) => p.formatName.split(',').includes(f)) || !p.video || p.video.width === 0)
    return avi ? 'File không phải video MP4, MOV, WebM hoặc AVI' : 'File không phải video MP4, MOV hoặc WebM';
  if (p.video.width * p.video.height > 4096 * 4096) return 'Độ phân giải video quá lớn';
  if (!(p.durationSec > 0)) return 'Không đọc được thời lượng video';
  if (p.durationSec > maxSec + 0.5) return `Video dài hơn ${maxSec} giây`;
  return null;
}

// MP4 H.264 + AAC, tối đa 720×1280, faststart, bỏ mọi metadata gốc (GPS, máy quay). ffmpeg tự xoay theo
// cờ xoay của iPhone nên video ra đúng chiều và không còn cờ xoay.
export async function transcode(
  src: string,
  outMp4: string,
  outPoster: string,
  durationSec: number,
  opts: { maxSec?: number; timeoutMs?: number; look?: string | null; trim?: Trim | null } = {},
) {
  await run(
    'ffmpeg',
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      ...trimArgs(opts.trim),
      '-i',
      src,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-vf',
      `scale=w='min(720,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,${opts.look ? `${opts.look},` : ''}format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '24',
      '-profile:v',
      'high',
      '-level:v',
      '4.0',
      '-maxrate',
      '2500k',
      '-bufsize',
      '5000k',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      '-map_metadata',
      '-1',
      '-map_metadata:s:v',
      '-1',
      '-map_metadata:s:a',
      '-1',
      '-map_chapters',
      '-1',
      '-movflags',
      '+faststart',
      '-t',
      String((opts.maxSec ?? MAX_DURATION_SEC) + 1),
      '-f',
      'mp4',
      outMp4,
    ],
    opts.timeoutMs ?? TRANSCODE_TIMEOUT_MS,
  );
  await makePoster(outMp4, outPoster, durationSec);
}

// Ảnh bìa: khung hình ở giây thứ 1 (hoặc giữa video nếu ngắn hơn 2 giây).
export async function makePoster(outMp4: string, outPoster: string, durationSec: number) {
  await run(
    'ffmpeg',
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(Math.min(1, durationSec / 2)),
      '-i',
      outMp4,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      '-map_metadata',
      '-1',
      '-f',
      'image2',
      outPoster,
    ],
    PROBE_TIMEOUT_MS,
  );
}

const ENCODE_ARGS = [
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  '24',
  '-profile:v',
  'high',
  '-level:v',
  '4.0',
  '-maxrate',
  '2500k',
  '-bufsize',
  '5000k',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-ac',
  '2',
  '-map_metadata',
  '-1',
  '-map_chapters',
  '-1',
  '-movflags',
  '+faststart',
];

// Duet (SPEC-creator.md bổ sung 27/10): ghép 2 video cạnh nhau thành 720×1280 — trái video gốc, phải video mới,
// mỗi bên cắt giữa khung 360×1280. Tiếng: video mới + video gốc nhỏ hơn. Dài bằng video mới (video gốc lặp lại).
export function duetArgs(
  newSrc: string,
  origSrc: string,
  outMp4: string,
  opts: { durationSec: number; newAudio: boolean; origAudio: boolean },
): string[] {
  const side = 'scale=360:1280:force_original_aspect_ratio=increase,crop=360:1280,setsar=1';
  const audio =
    opts.newAudio && opts.origAudio
      ? ';[1:a]volume=0.35[ga];[0:a][ga]amix=inputs=2:duration=first:dropout_transition=0[a]'
      : opts.newAudio
        ? ';[0:a]anull[a]'
        : opts.origAudio
          ? ';[1:a]volume=0.35[a]'
          : '';
  return [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    newSrc,
    '-stream_loop',
    '-1',
    '-i',
    origSrc,
    '-filter_complex',
    `[1:v]${side}[l];[0:v]${side}[r];[l][r]hstack=inputs=2,format=yuv420p[v]${audio}`,
    '-map',
    '[v]',
    ...(audio ? ['-map', '[a]'] : []),
    ...ENCODE_ARGS,
    '-t',
    String(Math.min(opts.durationSec, MAX_DURATION_SEC + 1)),
    '-f',
    'mp4',
    outMp4,
  ];
}

export async function composeDuet(
  newSrc: string,
  origSrc: string,
  outMp4: string,
  outPoster: string,
  opts: { durationSec: number; newAudio: boolean; origAudio: boolean },
) {
  await run('ffmpeg', duetArgs(newSrc, origSrc, outMp4, opts), TRANSCODE_TIMEOUT_MS);
  await makePoster(outMp4, outPoster, opts.durationSec);
}

// Stitch (SPEC-creator.md V5.5 mục 4): đoạn [from, to] của video gốc rồi tới video mới, cùng đưa về 720×1280. Đoạn nào
// không có tiếng thì thêm im lặng đúng độ dài để nối được.
export function stitchArgs(
  origSrc: string,
  newSrc: string,
  outMp4: string,
  opts: {
    fromSec: number;
    toSec: number;
    newSec: number;
    origAudio: boolean;
    newAudio: boolean;
    maxSec: number;
  },
): string[] {
  const clip = opts.toSec - opts.fromSec;
  const frame =
    'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p';
  const inputs = ['-ss', opts.fromSec.toFixed(3), '-t', clip.toFixed(3), '-i', origSrc, '-i', newSrc];
  let next = 2;
  const silence = (seconds: number) => {
    inputs.push('-f', 'lavfi', '-t', seconds.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo');
    return `${next++}:a`;
  };
  const a0 = opts.origAudio ? '0:a:0' : silence(clip);
  const a1 = opts.newAudio ? '1:a:0' : silence(opts.newSec);
  const norm = 'aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo';
  return [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    `[0:v]${frame}[v0];[1:v]${frame}[v1];[${a0}]${norm}[a0];[${a1}]${norm}[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    ...ENCODE_ARGS,
    '-t',
    String(Math.min(clip + opts.newSec, opts.maxSec + 1)),
    '-f',
    'mp4',
    outMp4,
  ];
}

export async function composeStitch(
  origSrc: string,
  newSrc: string,
  outMp4: string,
  outPoster: string,
  opts: Parameters<typeof stitchArgs>[3],
) {
  await run('ffmpeg', stitchArgs(origSrc, newSrc, outMp4, opts), TRANSCODE_TIMEOUT_MS);
  await makePoster(outMp4, outPoster, opts.toSec - opts.fromSec + opts.newSec);
}
