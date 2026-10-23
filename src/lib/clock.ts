// Mọi logic nghiệp vụ lấy giờ qua now() để test tua được các mốc 15 phút / 48 giờ / 7 ngày.

let frozen: Date | null = null;

export function now(): Date {
  return frozen ? new Date(frozen) : new Date();
}

export function setClock(at: Date): void {
  frozen = new Date(at);
}

export function advanceClock(by: {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}): void {
  const ms =
    ((by.days ?? 0) * 86_400 + (by.hours ?? 0) * 3_600 + (by.minutes ?? 0) * 60 + (by.seconds ?? 0)) * 1_000;
  frozen = new Date(now().getTime() + ms);
}

export function resetClock(): void {
  frozen = null;
}

// 0 giờ ngày hôm nay theo giờ Việt Nam (UTC+7, không đổi giờ theo mùa).
export function startOfVnDay(at: Date = now()): Date {
  const offset = 7 * 3_600_000;
  return new Date(Math.floor((at.getTime() + offset) / 86_400_000) * 86_400_000 - offset);
}
