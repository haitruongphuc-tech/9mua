import { describe, expect, it } from 'vitest';
import { createPexels } from './pexels';

type Call = { url: string; auth: string | null };

function fakeFetch(routes: Record<string, unknown>, calls: Call[] = []) {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) return new Response('not found', { status: 404 });
    const body = routes[key];
    return body instanceof Buffer
      ? new Response(new Uint8Array(body), { status: 200 })
      : new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const bytes = (s: string) => Buffer.from(s);

describe('Pexels (ảnh/video thật cho dữ liệu mẫu)', () => {
  it('ảnh: tìm theo từ khoá, gửi khoá API ở header Authorization, tải bản large2x', async () => {
    const calls: Call[] = [];
    const pexels = createPexels(
      'khoa-thu',
      fakeFetch(
        {
          'https://api.pexels.com/v1/search': {
            photos: [
              { src: { large2x: 'https://images.pexels.com/1.jpeg?l2x', landscape: 'https://img/land' } },
            ],
          },
          'https://images.pexels.com/1.jpeg': bytes('anh-xoai'),
        },
        calls,
      ),
    );
    expect(Buffer.from((await pexels.photo('mango fruit'))!).toString()).toBe('anh-xoai');
    const search = new URL(calls[0]!.url);
    expect(search.searchParams.get('query')).toBe('mango fruit');
    expect(calls[0]!.auth).toBe('khoa-thu');
    // Tải file ảnh từ CDN không gửi khoá API.
    expect(calls[1]).toEqual({ url: 'https://images.pexels.com/1.jpeg?l2x', auth: null });
  });

  it('video: chọn video dọc ≤ 30 giây, file mp4 nhỏ nhất cao từ 960px', async () => {
    const calls: Call[] = [];
    const pexels = createPexels(
      'k',
      fakeFetch(
        {
          'https://api.pexels.com/videos/search': {
            videos: [
              { duration: 75, width: 1080, height: 1920, video_files: [] },
              { duration: 12, width: 1920, height: 1080, video_files: [] },
              {
                duration: 14,
                width: 1080,
                height: 1920,
                video_files: [
                  {
                    quality: 'hd',
                    file_type: 'video/mp4',
                    width: 1080,
                    height: 1920,
                    link: 'https://v/1080',
                  },
                  { quality: 'sd', file_type: 'video/mp4', width: 540, height: 960, link: 'https://v/540' },
                  { quality: 'sd', file_type: 'video/mp4', width: 360, height: 640, link: 'https://v/360' },
                  {
                    quality: 'hls',
                    file_type: 'application/x-mpegURL',
                    width: null,
                    height: null,
                    link: 'https://v/m3u8',
                  },
                ],
              },
            ],
          },
          'https://v/540': bytes('video-540'),
        },
        calls,
      ),
    );
    expect(Buffer.from((await pexels.video('fruit market'))!).toString()).toBe('video-540');
    const search = new URL(calls[0]!.url);
    expect(search.searchParams.get('orientation')).toBe('portrait');
    expect(calls[0]!.auth).toBe('k');
  });

  it('lỗi mạng, sai khoá hay không có kết quả thì trả null (dữ liệu mẫu quay về ảnh vẽ sẵn)', async () => {
    const down = createPexels('k', (async () => {
      throw new Error('ENOTFOUND');
    }) as typeof fetch);
    expect(await down.photo('mango')).toBeNull();
    expect(await down.video('mango')).toBeNull();
    const wrongKey = createPexels('sai', (async () => new Response('{}', { status: 401 })) as typeof fetch);
    expect(await wrongKey.photo('mango')).toBeNull();
    // Pexels không trả lời 3 lần liên tiếp thì thôi gọi, không bắt chờ 20 giây cho từng ảnh.
    let attempts = 0;
    const slow = createPexels('k', (async () => {
      attempts += 1;
      throw new Error('timeout');
    }) as typeof fetch);
    for (let i = 0; i < 6; i++) await slow.photo('mango');
    expect(attempts).toBe(3);
    const empty = createPexels('k', fakeFetch({ 'https://api.pexels.com/': { photos: [], videos: [] } }));
    expect(await empty.photo('khong-co')).toBeNull();
    expect(await empty.video('khong-co')).toBeNull();
  });
});
