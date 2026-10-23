// Cộng đúng 1 năm theo lịch; 29/02 rơi vào năm không nhuận thì lùi về 28/02.
export function addOneYear(date: Date): Date {
  const next = new Date(date);
  next.setUTCFullYear(date.getUTCFullYear() + 1);
  if (next.getUTCMonth() !== date.getUTCMonth()) next.setUTCDate(0);
  return next;
}

// Gia hạn sớm thì cộng dồn từ hạn cũ; đã hết hạn thì tính từ lúc trả tiền (SPEC-billing.md mục 2).
export function nextPeriod(activeUntil: Date | null, at: Date): { start: Date; end: Date } {
  const start = activeUntil && activeUntil > at ? activeUntil : at;
  return { start, end: addOneYear(start) };
}
