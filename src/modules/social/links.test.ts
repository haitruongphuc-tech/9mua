import { describe, expect, it } from 'vitest';
import { hasLink } from './links';
import { vnDay } from './day';

describe('hasLink', () => {
  it.each(['xem http://a.b', 'https://shopee.vn/x', 'vào www.abc.net nhé', 'abc.com', 'zalo.me/0909', 'bit.ly/xyz'])(
    'chặn: %s',
    (t) => expect(hasLink(t)).toBe(true),
  );
  it.each(['Đẹp quá shop ơi', 'giá 1.500.000đ', 'size 3.5 ok', 'Mua 2 cái nha'])('cho qua: %s', (t) =>
    expect(hasLink(t)).toBe(false),
  );
});

describe('vnDay', () => {
  it('17:30 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(vnDay(new Date('2026-10-27T17:30:00Z'))).toBe('2026-10-28');
    expect(vnDay(new Date('2026-10-27T16:59:59Z'))).toBe('2026-10-27');
  });
});
