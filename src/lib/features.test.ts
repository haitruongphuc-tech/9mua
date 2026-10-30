import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { FEATURES, featureStates, isFeatureOn, missingKeys, saveFeature } from './features';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('công tắc chức năng (docs/nang-cap-mot-dot.md mục 3, SPEC-admin.md V5.0)', () => {
  it('mặc định đúng bảng: phần thường bật, phần đụng tiền và chờ khoá tắt', async () => {
    expect(await isFeatureOn('feed_tools')).toBe(true);
    expect(await isFeatureOn('posts')).toBe(true);
    for (const off of [
      'long_video',
      'points_exchange',
      'xu_spend',
      'cod',
      'play',
      'commission',
      'map',
    ] as const)
      expect(await isFeatureOn(off)).toBe(false);
    // Mọi công tắc đụng tiền đều tắt sẵn.
    for (const [name, f] of Object.entries(FEATURES)) if (f.money) expect(f.defaultOn, name).toBe(false);
  });

  it('bật/tắt lưu ở Setting (feature.<tên>), đọc lại ngay', async () => {
    await saveFeature('posts', false, null);
    expect(await isFeatureOn('posts')).toBe(false);
    expect(await db.setting.findUnique({ where: { key: 'feature.posts' } })).toMatchObject({ value: 'off' });
    await saveFeature('posts', true, null);
    expect(await isFeatureOn('posts')).toBe(true);
  });

  it('chờ khoá: thiếu biến môi trường thì không bật được và luôn coi là tắt', async () => {
    expect(missingKeys('map')).toEqual(['MAP_TILE_URL']);
    await expect(saveFeature('map', true, null)).rejects.toThrow('MISSING_KEYS');
    // Dù trong DB đang ghi "on" (vd. khoá bị gỡ sau đó) vẫn coi là tắt.
    await db.setting.create({ data: { key: 'feature.map', value: 'on' } });
    expect(await isFeatureOn('map')).toBe(false);
    vi.stubEnv('MAP_TILE_URL', 'https://tiles.example/{z}/{x}/{y}.png');
    expect(missingKeys('map')).toEqual([]);
    expect(await isFeatureOn('map')).toBe(true);
    // Chỉ cần một trong các khoá (GHN hoặc GHTK).
    expect(missingKeys('carriers')).toEqual(['GHN_TOKEN | GHTK_TOKEN']);
    vi.stubEnv('GHTK_TOKEN', 'x');
    expect(missingKeys('carriers')).toEqual([]);
  });

  it('chế độ thử (TEST_MODE=e2e) coi như có đủ khoá để thử bằng driver giả', async () => {
    vi.stubEnv('TEST_MODE', 'e2e');
    expect(missingKeys('apple_login')).toEqual([]);
  });

  it('featureStates trả đủ mọi công tắc kèm trạng thái và khoá còn thiếu', async () => {
    const states = await featureStates();
    expect(states.map((s) => s.name).sort()).toEqual(Object.keys(FEATURES).sort());
    expect(states.find((s) => s.name === 'bank_feed')).toMatchObject({
      on: false,
      money: false,
      missing: ['CASSO_API_KEY', 'CASSO_WEBHOOK_SECRET'],
    });
  });
});
