import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 50_000_000; // ~ ảnh 8000×6000; chặn "bom giải nén"
const MAIN_EDGE = 1200;
const THUMB_EDGE = 400;

export type ImageType = 'jpeg' | 'png' | 'webp' | 'heic';

// Nhận diện bằng magic bytes, không tin đuôi file hay Content-Type trình duyệt gửi.
export function detectImageType(buf: Buffer): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'webp';
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return null;
}

export type ProcessedImage = { ok: true; main: Buffer; thumb: Buffer; width: number; height: number };
export type ImageError = 'TOO_LARGE' | 'NOT_AN_IMAGE' | 'HEIC_UNSUPPORTED' | 'TOO_MANY_PIXELS';

// Kiểm tra chung trước khi xử lý: dung lượng, loại file thật, số điểm ảnh.
async function checkImage(input: Buffer): Promise<ImageError | null> {
  if (input.length > MAX_IMAGE_BYTES) return 'TOO_LARGE';
  const type = detectImageType(input);
  if (!type) return 'NOT_AN_IMAGE';
  // Bản sharp dựng sẵn không có codec HEVC; iPhone tự đổi HEIC → JPEG khi ô chọn file không nhận HEIC.
  if (type === 'heic') return 'HEIC_UNSUPPORTED';
  const meta = await sharp(input).metadata();
  if (!meta.width || !meta.height) return 'NOT_AN_IMAGE';
  if (meta.width * meta.height > MAX_PIXELS) return 'TOO_MANY_PIXELS';
  return null;
}

// Ảnh sản phẩm: xoay đúng chiều theo EXIF, thu về WebP 1200px + 400px, bỏ toàn bộ metadata (GPS…).
export async function processImage(
  input: Buffer,
): Promise<ProcessedImage | { ok: false; error: ImageError }> {
  try {
    const error = await checkImage(input);
    if (error) return { ok: false, error };

    const base = () => sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).rotate();
    const { data: main, info } = await base()
      .resize(MAIN_EDGE, MAIN_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base()
      .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75, effort: 4 })
      .toBuffer();
    return { ok: true, main, thumb, width: info.width, height: info.height };
  } catch {
    return { ok: false, error: 'NOT_AN_IMAGE' };
  }
}
// Ảnh cắt đúng khung (ảnh đại diện vuông, ảnh bìa 3:1): cắt phần giữa, WebP, bỏ metadata. Ảnh nhỏ hơn khung thì phóng lên.
export async function processCroppedImage(
  input: Buffer,
  size: { width: number; height: number },
): Promise<{ ok: true; data: Buffer } | { ok: false; error: ImageError }> {
  try {
    const error = await checkImage(input);
    if (error) return { ok: false, error };
    const data = await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
      .rotate()
      .resize(size.width, size.height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'NOT_AN_IMAGE' };
  }
}

// Câu báo lỗi theo từng ngôn ngữ: khoá "seller.img.<mã lỗi>" (src/i18n/module-messages.ts).
