import { describe, expect, it } from 'vitest';
import { createPexels, createPixabay } from './stock-media';

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

describe('Pixabay (thay Pexels khi Pexels ngừng cấp khoá mới)', () => {
  it('nhiều ảnh cho 1 sản phẩm: tải đủ số ảnh yêu cầu từ 1 lần tìm', async () => {
    const calls: Call[] = [];
    const pixabay = createPixabay(
      'k',
      fakeFetch(
        {
          'https://pixabay.com/api/?': {
            hits: [1, 2, 3, 4].map((n) => ({ largeImageURL: `https://cdn.pixabay.com/photo/${n}.jpg` })),
          },
          'https://cdn.pixabay.com/photo/': bytes('anh'),
        },
        calls,
      ),
    );
    expect(await pixabay.photos('mango', 'square', 3)).toHaveLength(3);
    expect(calls.filter((c) => c.url.startsWith('https://pixabay.com/api/'))).toHaveLength(1);
  });

  it('ảnh: khoá API gửi qua tham số key, tải bản largeImageURL', async () => {
    const calls: Call[] = [];
    const pixabay = createPixabay(
      'khoa-pb',
      fakeFetch(
        {
          'https://pixabay.com/api/?': {
            hits: [
              { largeImageURL: 'https://cdn.pixabay.com/photo/xoai_1280.jpg', webformatURL: 'https://w' },
            ],
          },
          'https://cdn.pixabay.com/photo/xoai_1280.jpg': bytes('anh-xoai'),
        },
        calls,
      ),
    );
    expect(Buffer.from((await pixabay.photo('mango fruit', 'landscape'))!).toString()).toBe('anh-xoai');
    const search = new URL(calls[0]!.url);
    expect(search.searchParams.get('key')).toBe('khoa-pb');
    expect(search.searchParams.get('q')).toBe('mango fruit');
    expect(search.searchParams.get('image_type')).toBe('photo');
    expect(search.searchParams.get('orientation')).toBe('horizontal');
    expect(Number(search.searchParams.get('per_page'))).toBeGreaterThanOrEqual(3); // Pixabay nhận 3–200
    expect(calls[1]!.url).toBe('https://cdn.pixabay.com/photo/xoai_1280.jpg');
  });

  it('video: ưu tiên video dọc ≤ 30 giây, lấy bản nhỏ nhất có cạnh ngắn từ 540px', async () => {
    const file = (w: number, h: number, url: string, size = 1_000_000) => ({
      url,
      width: w,
      height: h,
      size,
    });
    const pixabay = createPixabay(
      'k',
      fakeFetch({
        'https://pixabay.com/api/videos/': {
          hits: [
            {
              duration: 12,
              videos: {
                large: file(1920, 1080, 'https://v/ngang-1080'),
                medium: file(1280, 720, 'https://v/ngang-720'),
                small: file(960, 540, 'https://v/ngang-540'),
                tiny: file(640, 360, 'https://v/ngang-360'),
              },
            },
            { duration: 90, videos: { medium: file(720, 1280, 'https://v/doc-dai') } },
            {
              duration: 15,
              videos: {
                large: { url: '', width: 0, height: 0, size: 0 },
                medium: file(720, 1280, 'https://v/doc-720'),
                small: file(540, 960, 'https://v/doc-540'),
                tiny: file(360, 640, 'https://v/doc-360'),
              },
            },
          ],
        },
        'https://v/doc-540': bytes('video-doc'),
        'https://v/ngang-540': bytes('video-ngang'),
      }),
    );
    expect(Buffer.from((await pixabay.video('fruit'))!).toString()).toBe('video-doc');

    // Không có video dọc thì lấy video ngang (feed hiện có viền đen trên dưới).
    const landscapeOnly = createPixabay(
      'k',
      fakeFetch({
        'https://pixabay.com/api/videos/': {
          hits: [{ duration: 12, videos: { small: file(960, 540, 'https://v/ngang-540') } }],
        },
        'https://v/ngang-540': bytes('video-ngang'),
      }),
    );
    expect(Buffer.from((await landscapeOnly.video('fruit'))!).toString()).toBe('video-ngang');
  });

  it('giãn cách các lượt gọi API (hạn mức Pixabay 100 lượt/phút)', async () => {
    const times: number[] = [];
    const pixabay = createPixabay(
      'k',
      (async () => {
        times.push(Date.now());
        return new Response(JSON.stringify({ hits: [] }), { status: 200 });
      }) as typeof fetch,
      100,
    );
    for (let i = 0; i < 3; i++) await pixabay.photos('mango');
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(95);
    expect(times[2]! - times[1]!).toBeGreaterThanOrEqual(95);
  });

  it('lỗi hay không có kết quả thì trả null; lỗi 3 lần liên tiếp thì thôi gọi', async () => {
    let attempts = 0;
    const down = createPixabay('k', (async () => {
      attempts += 1;
      return new Response('{}', { status: 400 });
    }) as typeof fetch);
    for (let i = 0; i < 5; i++) expect(await down.photo('mango')).toBeNull();
    expect(attempts).toBe(3);
    const empty = createPixabay('k', fakeFetch({ 'https://pixabay.com/api/': { hits: [] } }));
    expect(await empty.photo('khong-co')).toBeNull();
    expect(await empty.video('khong-co')).toBeNull();
  });
});
