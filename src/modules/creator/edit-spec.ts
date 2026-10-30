import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hasLink } from '@/lib/links';
import {
  MAX_STICKERS,
  MAX_TEXT_CHARS,
  MAX_TEXTS,
  STICKERS,
  TEXT_COLORS,
  type EditSpec,
  type EditSticker,
  type EditText,
} from '@/lib/edit-spec';

// Chỉnh video (SPEC-creator.md V5.6 mục 1): kiểm editSpec người đăng gửi lên, rồi dựng thành bộ lọc ffmpeg khi xử lý.
// Chữ người dùng ghi ra file riêng (textfile, expansion=none): không bao giờ ghép chữ vào chuỗi lệnh ffmpeg.
export const FONT_FILE = path.resolve(process.cwd(), 'assets/fonts/BeVietnamPro-ExtraBold.ttf');
const MAX_SEC = 24 * 3600;

const num = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

function parseTiming(item: Record<string, unknown>) {
  const x = num(item.x, 0, 1);
  const y = num(item.y, 0, 1);
  const fromSec = num(item.fromSec, 0, MAX_SEC);
  const toSec = num(item.toSec, 0, MAX_SEC);
  if (x === null || y === null || fromSec === null || toSec === null || toSec <= fromSec) return null;
  return { x, y, fromSec, toSec };
}

// null: không hợp lệ. undefined / rỗng: không chỉnh gì.
export function parseEditSpec(input: unknown): EditSpec | null {
  if (input === null || input === undefined) return { trimStart: 0, trimEnd: null, texts: [], stickers: [] };
  if (typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const trimStart = raw.trimStart === undefined ? 0 : num(raw.trimStart, 0, MAX_SEC);
  const trimEnd = raw.trimEnd === undefined || raw.trimEnd === null ? null : num(raw.trimEnd, 0, MAX_SEC);
  if (trimStart === null || (raw.trimEnd !== undefined && raw.trimEnd !== null && trimEnd === null))
    return null;
  if (trimEnd !== null && trimEnd - trimStart < 1) return null;
  const textsIn = raw.texts ?? [];
  const stickersIn = raw.stickers ?? [];
  if (!Array.isArray(textsIn) || !Array.isArray(stickersIn)) return null;
  if (textsIn.length > MAX_TEXTS || stickersIn.length > MAX_STICKERS) return null;
  const texts: EditText[] = [];
  for (const t of textsIn as Record<string, unknown>[]) {
    const text = typeof t?.text === 'string' ? t.text.replace(/\s+/g, ' ').trim() : '';
    const timing = t && typeof t === 'object' ? parseTiming(t) : null;
    if (!text || text.length > MAX_TEXT_CHARS || hasLink(text) || !timing) return null;
    if (!TEXT_COLORS.includes(t.color as (typeof TEXT_COLORS)[number])) return null;
    texts.push({ text, color: t.color as string, ...timing });
  }
  const stickers: EditSticker[] = [];
  for (const s of stickersIn as Record<string, unknown>[]) {
    const timing = s && typeof s === 'object' ? parseTiming(s) : null;
    const sticker = STICKERS.find((x) => x.id === s?.id);
    if (!sticker || !timing) return null;
    stickers.push({ id: sticker.id, ...timing });
  }
  return { trimStart, trimEnd, texts, stickers };
}

export const isEmptyEdit = (spec: EditSpec | null) =>
  !spec ||
  (spec.trimStart === 0 && spec.trimEnd === null && spec.texts.length === 0 && spec.stickers.length === 0);

// Chuỗi drawtext cho chữ và nhãn dán (khung 720×1280 sau khi thu nhỏ). Ghi chữ ra file trong thư mục làm việc.
export async function overlayFilter(spec: EditSpec, workDir: string): Promise<string | null> {
  const parts: string[] = [];
  const shift = spec.trimStart;
  const enable = (from: number, to: number) =>
    `enable='between(t,${Math.max(0, from - shift).toFixed(2)},${Math.max(0, to - shift).toFixed(2)})'`;
  const place = (x: number, y: number) =>
    `x='min(max(0,${x.toFixed(4)}*w-text_w/2),w-text_w)':y='min(max(0,${y.toFixed(4)}*h-text_h/2),h-text_h)'`;
  let i = 0;
  for (const t of spec.texts) {
    const file = path.join(workDir, `text-${i++}.txt`);
    await writeFile(file, t.text);
    parts.push(
      `drawtext=fontfile=${FONT_FILE}:textfile=${file}:expansion=none:fontsize=h/24:fontcolor=${t.color}:borderw=3:bordercolor=black@0.55:${place(t.x, t.y)}:${enable(t.fromSec, t.toSec)}`,
    );
  }
  for (const s of spec.stickers) {
    const sticker = STICKERS.find((x) => x.id === s.id)!;
    const file = path.join(workDir, `sticker-${i++}.txt`);
    await writeFile(file, sticker.label);
    parts.push(
      `drawtext=fontfile=${FONT_FILE}:textfile=${file}:expansion=none:fontsize=h/28:fontcolor=white:box=1:boxcolor=${sticker.bg}@0.95:boxborderw=14:${place(s.x, s.y)}:${enable(s.fromSec, s.toSec)}`,
    );
  }
  return parts.length ? parts.join(',') : null;
}
