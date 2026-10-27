import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDateTimeVN, formatVnd, parseVndInput } from './format';

describe('format', () => {
  it('formatDate: chỉ ngày, theo giờ Việt Nam', () => {
    const d = new Date('2026-10-26T18:00:00Z'); // 27/10 01:00 giờ VN
    expect(formatDate(d, 'vi')).toBe('27/10/2026');
    expect(formatDate(d, 'en')).toBe('10/27/2026');
  });
  it('formatVnd', () => {
    expect(formatVnd(26000)).toBe('26.000đ');
    expect(formatVnd(1250000)).toBe('1.250.000đ');
  });
  it('formatDateTime theo ngôn ngữ, luôn giờ Việt Nam; tiếng Việt giống formatDateTimeVN', () => {
    const d = new Date('2026-10-27T03:05:00Z'); // 10:05 giờ Việt Nam
    expect(formatDateTime(d, 'vi')).toBe(formatDateTimeVN(d));
    expect(formatDateTime(d, 'en')).toContain('10:05');
    expect(formatDateTime(d, 'ja')).toContain('2026/10/27');
  });
  it('parseVndInput', () => {
    expect(parseVndInput('45.000')).toBe(45000);
    expect(parseVndInput('45,000đ')).toBe(45000);
    expect(parseVndInput('')).toBeNull();
    expect(parseVndInput(null)).toBeNull();
  });
});
