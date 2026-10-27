import { afterEach, describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock, startOfVnMonth } from './clock';

afterEach(() => resetClock());

describe('clock', () => {
  it('mặc định trả thời gian thật', () => {
    const before = Date.now();
    expect(now().getTime()).toBeGreaterThanOrEqual(before);
  });

  it('cho test đặt và tua thời gian', () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    advanceClock({ days: 7, hours: 1 });
    expect(now().toISOString()).toBe('2026-10-30T01:00:00.000Z');
  });

  it('trả bản sao để không bị sửa ngoài ý muốn', () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    now().setFullYear(2000);
    expect(now().getUTCFullYear()).toBe(2026);
  });

  it('đầu tháng theo giờ Việt Nam', () => {
    // 31/10 23:30 giờ VN vẫn là tháng 10; 1/11 00:30 giờ VN (31/10 17:30 UTC) đã sang tháng 11.
    expect(startOfVnMonth(new Date('2026-10-31T16:30:00Z')).toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(startOfVnMonth(new Date('2026-10-31T17:30:00Z')).toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(startOfVnMonth(new Date('2027-01-01T03:00:00Z')).toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });
});
