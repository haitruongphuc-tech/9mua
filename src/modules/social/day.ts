import { now } from '@/lib/clock';

// Ngày theo giờ Việt Nam (YYYY-MM-DD) cho các giới hạn "mỗi ngày".
export function vnDay(at: Date = now()): string {
  return new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
