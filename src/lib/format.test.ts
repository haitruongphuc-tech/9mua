import { describe, expect, it } from 'vitest';
import { formatVnd, parseVndInput } from './format';

describe('format', () => {
  it('formatVnd', () => {
    expect(formatVnd(26000)).toBe('26.000đ');
    expect(formatVnd(1250000)).toBe('1.250.000đ');
  });
  it('parseVndInput', () => {
    expect(parseVndInput('45.000')).toBe(45000);
    expect(parseVndInput('45,000đ')).toBe(45000);
    expect(parseVndInput('')).toBeNull();
    expect(parseVndInput(null)).toBeNull();
  });
});
