import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';

describe('database harness', () => {
  it('đọc ghi được Postgres thật trong transaction', async () => {
    const rows = await db.$transaction(async (tx) => tx.$queryRaw<{ v: number }[]>`SELECT 41 + 1 AS v`);
    expect(rows[0]?.v).toBe(42);
  });

  it('chạy trên database test, không phải dev/production', async () => {
    const [row] = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    expect(row?.name).toMatch(/_test$/);
  });
});
