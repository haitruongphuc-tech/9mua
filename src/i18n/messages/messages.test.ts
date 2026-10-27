import { describe, expect, it } from 'vitest';
import { LANGS } from '../config';
import { DICTS } from './index';
import { vi } from './vi';

describe('từ điển 7 thứ tiếng', () => {
  it.each(LANGS.map((l) => l.code))('%s có đủ khoá như tiếng Việt, không ô trống', (code) => {
    const dict = DICTS[code];
    expect(Object.keys(dict).sort()).toEqual(Object.keys(vi).sort());
    for (const [k, v] of Object.entries(dict)) expect(v.trim(), k).not.toBe('');
  });

  it.each(LANGS.filter((l) => l.code !== 'vi').map((l) => l.code))('%s giữ đúng các biến {..}', (code) => {
    for (const [k, v] of Object.entries(vi)) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(DICTS[code][k as keyof typeof vi]), `${code} ${k}`).toEqual(vars(v));
    }
  });
});
