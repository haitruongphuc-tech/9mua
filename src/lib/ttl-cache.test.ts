import { describe, expect, it, vi } from 'vitest';
import { cached } from './ttl-cache';

describe('cache theo thời gian', () => {
  it('gọi 1 lần trong thời hạn; hết hạn thì tải lại; lỗi thì không giữ', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => 1);
    await cached('a', 60, load);
    await cached('a', 60, load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    await cached('a', 60, load);
    expect(load).toHaveBeenCalledTimes(2);

    const failing = vi.fn(async () => {
      throw new Error('db');
    });
    await expect(cached('b', 60, failing)).rejects.toThrow('db');
    await expect(cached('b', 60, failing)).rejects.toThrow('db');
    expect(failing).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
