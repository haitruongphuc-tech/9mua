import { describe, expect, it } from 'vitest';
import { langCookieOptions, pickLang } from './config';

describe('pickLang', () => {
  it('cookie đã chọn thắng ngôn ngữ trình duyệt', () => {
    expect(pickLang('en', 'ja-JP,ja;q=0.9')).toBe('en');
  });
  it('cookie lạ thì bỏ qua', () => {
    expect(pickLang('de', 'ko-KR')).toBe('ko');
  });
  it.each([
    ['ja-JP,ja;q=0.9,en;q=0.8', 'ja'],
    ['de-DE,de;q=0.9,fr;q=0.5', 'fr'],
    ['de-DE', 'vi'],
    ['en;q=0.2,zh-CN;q=0.8', 'zh'],
    ['es-419', 'es'],
    ['', 'vi'],
  ] as const)('%s → %s', (header, lang) => {
    expect(pickLang(undefined, header)).toBe(lang);
  });
});

describe('langCookieOptions', () => {
  it('dùng chung cho mọi trang Kiot, 1 năm', () => {
    expect(langCookieOptions('https://9mua.com')).toMatchObject({
      domain: '.9mua.com',
      secure: true,
      maxAge: 31536000,
      httpOnly: false,
    });
  });
});
