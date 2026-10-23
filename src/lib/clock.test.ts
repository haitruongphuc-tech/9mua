import { afterEach, describe, expect, it } from 'vitest';
import { advanceClock, now, resetClock, setClock } from './clock';

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
});
