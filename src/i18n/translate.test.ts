import { describe, expect, it } from 'vitest';
import { pickMessages, translate } from './translate';

const vi = { 'a.hello': 'Chào {name}', 'a.only': 'Chỉ tiếng Việt', 'b.x': 'X' };
const en = { 'a.hello': 'Hello {name}', 'a.only': '', 'b.x': 'X' };

describe('translate', () => {
  it('thay biến', () => expect(translate(en, vi, 'a.hello', { name: 'Hải' })).toBe('Hello Hải'));
  it('thiếu bản dịch thì dùng tiếng Việt', () => expect(translate(en, vi, 'a.only')).toBe('Chỉ tiếng Việt'));
  it('khoá không tồn tại thì trả chuỗi rỗng, không lộ mã khoá', () =>
    expect(translate(en, vi, 'zz')).toBe(''));
  it('biến thiếu giữ nguyên chỗ trống', () => expect(translate(en, vi, 'a.hello')).toBe('Hello {name}'));
});

describe('pickMessages', () => {
  it('chỉ lấy khoá theo tiền tố', () => expect(pickMessages(vi, ['b.'])).toEqual({ 'b.x': 'X' }));
});
