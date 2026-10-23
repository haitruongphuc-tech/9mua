import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { detectImageType, processImage } from './process-image';

// Ảnh nhiễu để có dung lượng lớn như ảnh chụp điện thoại thật, kèm EXIF có toạ độ GPS.
async function photo(width: number, height: number, quality = 95) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .withExif({
      IFD0: { Make: 'Apple', Model: 'iPhone 15' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '10/1 47/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '106/1 39/1 0/1',
      },
    })
    .jpeg({ quality })
    .toBuffer();
}

describe('detectImageType', () => {
  it('nhận diện theo nội dung, không theo đuôi file', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fc6f15' } })
      .png()
      .toBuffer();
    const webp = await sharp(png).webp().toBuffer();
    expect(detectImageType(await photo(4, 4))).toBe('jpeg');
    expect(detectImageType(png)).toBe('png');
    expect(detectImageType(webp)).toBe('webp');
    expect(detectImageType(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    expect(detectImageType(heic)).toBe('heic');
  });
});

describe('processImage', () => {
  it('ảnh điện thoại lớn có GPS → WebP ≤ 300KB, cạnh dài 1200px, không còn EXIF; có bản 400px', async () => {
    const input = await photo(3000, 2250);
    expect(input.length).toBeGreaterThan(4_000_000);
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processImage(input);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const main = await sharp(out.main).metadata();
    const thumb = await sharp(out.thumb).metadata();
    expect(main.format).toBe('webp');
    expect(Math.max(main.width!, main.height!)).toBe(1200);
    expect(Math.max(thumb.width!, thumb.height!)).toBe(400);
    expect(main.exif).toBeUndefined();
    expect(thumb.exif).toBeUndefined();
    expect(out.main.length).toBeLessThanOrEqual(300_000);
    expect(out.width).toBe(1200);
    expect(out.height).toBe(900);
  });

  it('không phóng to ảnh nhỏ', async () => {
    const out = await processImage(await photo(300, 200));
    expect(out.ok && out.width).toBe(300);
  });

  it('từ chối file không phải ảnh dù đổi đuôi', async () => {
    expect(await processImage(Buffer.from('MZ\x90\x00 fake exe renamed to .jpg'))).toEqual({
      ok: false,
      error: 'NOT_AN_IMAGE',
    });
  });

  it('HEIC báo lỗi riêng để hướng dẫn người dùng', async () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
    expect(await processImage(heic)).toEqual({ ok: false, error: 'HEIC_UNSUPPORTED' });
  });

  it('từ chối file quá 10MB', async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10 * 1024 * 1024)]);
    expect(await processImage(big)).toEqual({ ok: false, error: 'TOO_LARGE' });
  });

  it('JPEG hỏng không làm sập server', async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('garbage'.repeat(50))]);
    expect(await processImage(broken)).toEqual({ ok: false, error: 'NOT_AN_IMAGE' });
  });

  it('chống ảnh "bom giải nén" quá nhiều điểm ảnh', async () => {
    const huge = await sharp({ create: { width: 10_000, height: 10_000, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    expect(await processImage(huge)).toEqual({ ok: false, error: 'TOO_MANY_PIXELS' });
  });
});
