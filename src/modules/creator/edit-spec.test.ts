import { createReadStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { createUser } from '../../../tests/helpers/factories';
import { FONT_FILE, overlayFilter, parseEditSpec } from './edit-spec';
import { processNextJob } from './jobs';
import { probe } from './transcode';
import { createVideoUpload, saveUpload } from './upload';

const fileOf = (url: string) => path.join(env().UPLOAD_DIR, url.slice('/uploads/'.length));
const text = (over: Record<string, unknown> = {}) => ({
  text: 'Chào cả nhà 50%',
  color: '#ffffff',
  x: 0.5,
  y: 0.2,
  fromSec: 0,
  toSec: 2,
  ...over,
});

describe('chỉnh video: cắt, chữ, nhãn dán (SPEC-creator.md V5.6 mục 1)', () => {
  it('kiểm editSpec: tối đa 5 dòng chữ ≤ 60 ký tự, 6 màu, không link, nhãn dán của 9MUA, cắt ≥ 1 giây', () => {
    expect(parseEditSpec(undefined)).toEqual({ trimStart: 0, trimEnd: null, texts: [], stickers: [] });
    expect(
      parseEditSpec({
        trimStart: 0.5,
        trimEnd: 3,
        texts: [text()],
        stickers: [{ id: 'mua-ngay', x: 0.5, y: 0.8, fromSec: 1, toSec: 3 }],
      }),
    ).toMatchObject({
      trimStart: 0.5,
      trimEnd: 3,
      texts: [{ text: 'Chào cả nhà 50%' }],
      stickers: [{ id: 'mua-ngay' }],
    });
    for (const bad of [
      { texts: Array.from({ length: 6 }, () => text()) },
      { texts: [text({ text: 'x'.repeat(61) })] },
      { texts: [text({ text: 'xem tại shopee.vn/abc' })] },
      { texts: [text({ color: 'red' })] },
      { texts: [text({ x: 1.2 })] },
      { texts: [text({ fromSec: 3, toSec: 2 })] },
      { stickers: [{ id: 'khong-co', x: 0.5, y: 0.5, fromSec: 0, toSec: 1 }] },
      { trimStart: 2, trimEnd: 2.5 },
      [],
    ])
      expect(parseEditSpec(bad), JSON.stringify(bad)).toBeNull();
  });

  it('bộ lọc vẽ chữ: font Be Vietnam Pro đủ dấu, chữ ghi ra file và tắt mã %, thời gian trừ phần cắt đầu', async () => {
    const dir = path.join(os.tmpdir(), 'ninemua-edit');
    await mkdir(dir, { recursive: true });
    const spec = parseEditSpec({ trimStart: 1, texts: [text({ fromSec: 1.5, toSec: 4 })] })!;
    const filter = (await overlayFilter(spec, dir))!;
    expect(filter).toContain(`fontfile=${FONT_FILE}`);
    expect(filter).toContain('expansion=none');
    expect(filter).toContain("enable='between(t,0.50,3.00)'");
    expect(filter).not.toContain('Chào'); // chữ nằm trong file, không nằm trong lệnh
    expect(await readFile(path.join(dir, 'text-0.txt'), 'utf8')).toBe('Chào cả nhà 50%');
  });

  it('worker áp cắt đầu/cuối và vẽ chữ, nhãn dán khi xử lý', { timeout: 60_000 }, async () => {
    const u = await createUser();
    const saved = await saveUpload(u.id, createReadStream('tests/fixtures/videos/landscape.mp4'));
    if (!saved.ok) throw new Error(saved.error);
    expect(
      await createVideoUpload(u.id, saved.uploadId, {
        caption: 'x',
        productIds: [],
        options: { editSpec: { texts: [text({ text: 'x'.repeat(61) })] } },
      }),
    ).toEqual({ ok: false, error: 'EDIT_INVALID' });
    const r = await createVideoUpload(u.id, saved.uploadId, {
      caption: 'chỉnh',
      productIds: [],
      options: {
        editSpec: {
          trimStart: 0.4,
          trimEnd: 1.6,
          texts: [text()],
          stickers: [{ id: 'giam-gia', x: 0.5, y: 0.85, fromSec: 0, toSec: 2 }],
        },
      },
    });
    if (!r.ok) throw new Error(r.error);
    expect(await processNextJob()).toBe(true);
    const v = await db.video.findUniqueOrThrow({ where: { id: r.videoId } });
    expect(v.status).toBe('ready');
    expect(v.editSpec).toMatchObject({ trimStart: 0.4, trimEnd: 1.6 });
    const out = await probe(fileOf(v.fileUrl!));
    expect(out.durationSec).toBeGreaterThan(1.0);
    expect(out.durationSec).toBeLessThan(1.45);
  });
});
