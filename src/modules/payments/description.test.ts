import { describe, expect, it } from 'vitest';
import { normalizeDescription } from './description';

describe('normalizeDescription', () => {
  it.each([
    ['KIOT1234', 'KIOT1234'],
    ['dh-58213', 'DH58213'],
    ['Kiốt Đặc biệt 99', 'KIOTDACBI'],
    ['  9mua  ', '9MUA'],
  ])('%s → %s', (input, out) => {
    expect(normalizeDescription(input)).toBe(out);
  });

  it('luôn ≤ 9 ký tự A-Z0-9 và không rỗng', () => {
    expect(normalizeDescription('!!!')).toBe('9MUA');
    expect(normalizeDescription('x'.repeat(40))).toHaveLength(9);
  });
});
