import { describe, expect, it } from 'vitest';
import { sloganOverrides } from './overrides';

describe('sloganOverrides', () => {
  it('chỉ lấy câu của đúng thứ tiếng, bỏ ô trống; JSON hỏng thì không đổi gì', () => {
    const json = JSON.stringify({ home: { vi: 'Câu mới', en: '  ' }, live: { en: 'Live now' } });
    expect(sloganOverrides(json, 'vi')).toEqual({ 'common.slogan.home': 'Câu mới' });
    expect(sloganOverrides(json, 'en')).toEqual({ 'common.slogan.live': 'Live now' });
    expect(sloganOverrides('hỏng', 'vi')).toEqual({});
  });
});
