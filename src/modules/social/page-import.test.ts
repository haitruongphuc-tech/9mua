import { afterEach, describe, expect, it } from 'vitest';
import { createUser } from '../../../tests/helpers/factories';
import { availableNetworks, disconnectNetwork, importedPages, importPages, lookupPages } from './page-import';

describe('nhập Page (SPEC-kiot.md V5.4)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('không có khoá thì không mạng nào; có khoá YouTube thì gọi đúng API, chỉ lấy tên/ảnh/link/số theo dõi', async () => {
    delete process.env.TEST_MODE;
    delete process.env.PAGEIMPORT_DRIVER;
    delete process.env.PAGEIMPORT_YOUTUBE_KEY;
    expect(availableNetworks()).toEqual([]);
    process.env.PAGEIMPORT_YOUTUBE_KEY = 'khoa-thu';
    expect(availableNetworks()).toEqual(['youtube']);
    let called = '';
    const fake = (async (url: string) => {
      called = url;
      return new Response(
        JSON.stringify({
          items: [
            {
              id: 'UC1',
              snippet: { title: 'Kênh Thử', thumbnails: { default: { url: 'https://img/1.jpg' } } },
              statistics: { subscriberCount: '1234' },
            },
          ],
        }),
      );
    }) as unknown as typeof fetch;
    const pages = await lookupPages('youtube', 'https://www.youtube.com/@kenhthu', fake);
    expect(called).toContain('forHandle=kenhthu');
    expect(pages).toEqual([
      {
        externalId: 'UC1',
        name: 'Kênh Thử',
        avatarUrl: 'https://img/1.jpg',
        url: 'https://www.youtube.com/channel/UC1',
        followers: 1234,
      },
    ]);
  });

  it('driver giả: nhập Page đã tick; chưa có Kiot tối đa 1 Page; ngắt kết nối thì xoá', async () => {
    process.env.PAGEIMPORT_DRIVER = 'fake';
    const u = await createUser();
    const found = await lookupPages('facebook', '@cuahang');
    expect(found).toHaveLength(2);
    expect(
      await importPages(
        u.id,
        'facebook',
        '@cuahang',
        found.map((p) => p.externalId),
        false,
      ),
    ).toEqual({
      ok: false,
      error: 'LIMIT',
    });
    expect(await importPages(u.id, 'facebook', '@cuahang', [found[0]!.externalId], false)).toEqual({
      ok: true,
      imported: 1,
    });
    expect(await importPages(u.id, 'facebook', '@cuahang', ['khong-co'], true)).toEqual({
      ok: false,
      error: 'NONE',
    });
    expect(await importedPages(u.id)).toHaveLength(1);
    expect(await disconnectNetwork(u.id, 'facebook')).toBe(1);
    expect(await importedPages(u.id)).toHaveLength(0);
  });
});
