import { now } from './clock';
import { db } from './db';

// Đếm số lần một người làm một việc trong cửa sổ cố định (mặc định 60 giây). Trả về true nếu còn trong giới hạn.
// Một câu UPSERT nên nhiều request cùng lúc vẫn đếm đúng.
export async function withinRate(key: string, limit: number, windowMs = 60_000): Promise<boolean> {
  const t = now();
  const since = new Date(t.getTime() - windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateWindow" (key, "windowStart", count) VALUES (${key}, ${t}, 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateWindow"."windowStart" < ${since} THEN 1 ELSE "RateWindow".count + 1 END,
      "windowStart" = CASE WHEN "RateWindow"."windowStart" < ${since} THEN ${t} ELSE "RateWindow"."windowStart" END
    RETURNING count`;
  return (rows[0]?.count ?? 1) <= limit;
}
