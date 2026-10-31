import { describe, expect, it } from 'vitest';
import { resetClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setSetting } from '@/lib/settings';
import { invalidateCached } from '@/lib/ttl-cache';
import { createProduct, createSeller, createUser } from '../../../tests/helpers/factories';
import {
  cleanupSearchLog,
  clearSearchHistory,
  hotKeywords,
  logSearch,
  searchHistory,
  suggest,
} from './search-log';

describe('gợi ý, lịch sử, từ khoá hot (SPEC-marketplace.md V5.4)', () => {
  it('lịch sử 20 từ gần nhất, không trùng; xoá từng từ / xoá hết; không có người thì không ghi', async () => {
    const u = await createUser();
    await logSearch({ userId: u.id, q: 'Xoài Cát', tab: 'tat-ca', results: 3 });
    await logSearch({ userId: u.id, q: 'xoai cat', tab: 'san-pham', results: 3 });
    await logSearch({ userId: u.id, q: 'Bưởi', tab: 'tat-ca', results: 0 });
    await logSearch({ q: 'ai đó', tab: 'tat-ca', results: 0 });
    expect(await searchHistory(u.id)).toEqual(['buoi', 'xoai cat']);
    await clearSearchHistory(u.id, 'Bưởi');
    expect(await searchHistory(u.id)).toEqual(['xoai cat']);
    await clearSearchHistory(u.id);
    expect(await searchHistory(u.id)).toEqual([]);
  });

  it('từ khoá hot: từ 5 người khác nhau trong 7 ngày; từ CEO ẩn thì không hiện; xoá dòng > 90 ngày', async () => {
    const word = `sau rieng ${Date.now() % 100000}`;
    for (let i = 0; i < 5; i += 1)
      await logSearch({ anonId: `anon-hot-${word}-${i}`, q: word, tab: 'tat-ca', results: 1 });
    await logSearch({ anonId: 'anon-hot-x', q: `${word} it nguoi`, tab: 'tat-ca', results: 1 });
    invalidateCached('hot-keywords');
    const hot = await hotKeywords();
    expect(hot).toContain(word);
    expect(hot).not.toContain(`${word} it nguoi`);
    await setSetting('search_hidden_json', JSON.stringify({ words: ['Sầu riêng'] }), null);
    invalidateCached('hot-keywords');
    expect(await hotKeywords()).not.toContain(word);
    await setSetting('search_hidden_json', '{"words":[]}', null);

    setClock(new Date(Date.now() + 91 * 86_400_000));
    try {
      expect(await cleanupSearchLog()).toBeGreaterThanOrEqual(6);
    } finally {
      resetClock();
    }
    expect(await db.searchLog.count({ where: { query: word } })).toBe(0);
  });

  it('gợi ý khi gõ: tên sản phẩm và tên Kiot khớp đầu từ, tối đa 8', async () => {
    const tag = `mangcut${Date.now() % 100000}`;
    const s = await createSeller({ active: true });
    await db.kiot.update({ where: { id: s.kiotId }, data: { name: `Vườn ${tag}` } });
    await createProduct(s.kiotId, { name: `${tag} Lái Thiêu` });
    const out = await suggest(tag);
    expect(out.map((x) => x.kind).sort()).toEqual(['kiot', 'product']);
    expect(out.length).toBeLessThanOrEqual(8);
    expect(await suggest('a')).toEqual([]);
  });
});
