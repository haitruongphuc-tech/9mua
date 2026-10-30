import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeS3Client, S3MediaStore } from './s3-store';

const BASE = 'https://media.9mua.test';

describe('kho video ngoài — driver s3 (SPEC-creator.md V5.1 mục 9)', () => {
  it('ghi file với đúng bucket, khoá, kiểu file và Cache-Control; trả link công khai; xoá file tạm', async () => {
    const client = new FakeS3Client();
    const store = new S3MediaStore(client, 'video-9mua', BASE);
    expect(await store.save('videos/2026/10/a.jpg', Buffer.from('anh'))).toBe(`${BASE}/videos/2026/10/a.jpg`);
    const dir = path.join(os.tmpdir(), 'ninemua-s3-test');
    await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, 'v.mp4');
    await writeFile(tmp, Buffer.alloc(1234));
    expect(await store.saveFile('videos/2026/10/a.mp4', tmp)).toBe(`${BASE}/videos/2026/10/a.mp4`);
    expect(existsSync(tmp)).toBe(false);
    expect(client.objects.get('videos/2026/10/a.mp4')).toMatchObject({
      bucket: 'video-9mua',
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    expect(client.objects.get('videos/2026/10/a.mp4')!.body.length).toBe(1234);
    expect(await store.sizeOf(`${BASE}/videos/2026/10/a.mp4`)).toBe(1234);
    expect(store.localPath(`${BASE}/videos/2026/10/a.mp4`)).toBeNull();
  });

  it('kiểu file cho HLS và ảnh', async () => {
    const client = new FakeS3Client();
    const store = new S3MediaStore(client, 'b', BASE);
    for (const [key, type] of [
      ['videos/x-hls/master.m3u8', 'application/vnd.apple.mpegurl'],
      ['videos/x-hls/360p/seg0001.m4s', 'video/iso.segment'],
      ['videos/x-hls/360p/init.mp4', 'video/mp4'],
      ['videos/x-p.webp', 'image/webp'],
    ] as const) {
      await store.save(key, Buffer.from('x'));
      expect(client.objects.get(key)!.contentType, key).toBe(type);
    }
  });

  it('xoá cả thư mục HLS (nhiều trang danh sách), không đụng file ngoài thư mục; bỏ qua link không thuộc kho', async () => {
    const client = new FakeS3Client();
    const store = new S3MediaStore(client, 'b', BASE);
    for (let i = 0; i < 1005; i++) await store.save(`videos/v1-hls/360p/seg${i}.m4s`, Buffer.from('x'));
    await store.save('videos/v1-hls-khac/master.m3u8', Buffer.from('x'));
    await store.save('videos/v2.mp4', Buffer.from('x'));
    await store.removeDir(`${BASE}/videos/v1-hls`);
    expect([...client.objects.keys()].sort()).toEqual(['videos/v1-hls-khac/master.m3u8', 'videos/v2.mp4']);
    await store.remove('/uploads/videos/v2.mp4');
    await store.remove('https://kho-khac.test/videos/v2.mp4');
    expect(client.objects.has('videos/v2.mp4')).toBe(true);
    await store.remove(`${BASE}/videos/v2.mp4`);
    expect(client.objects.has('videos/v2.mp4')).toBe(false);
  });
});
