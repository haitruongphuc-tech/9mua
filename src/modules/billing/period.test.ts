import { describe, expect, it } from 'vitest';
import { addOneYear, nextPeriod } from './period';

const d = (s: string) => new Date(s);

describe('kỳ hạn thuê Kiot', () => {
  it('Kiot mới: tính từ lúc trả tiền, đủ 1 năm', () => {
    expect(nextPeriod(null, d('2026-10-23T03:00:00Z'))).toEqual({
      start: d('2026-10-23T03:00:00Z'),
      end: d('2027-10-23T03:00:00Z'),
    });
  });

  it('gia hạn sớm khi còn 100 ngày: cộng dồn, không mất ngày', () => {
    const activeUntil = d('2027-01-31T00:00:00Z');
    expect(nextPeriod(activeUntil, d('2026-10-23T00:00:00Z'))).toEqual({
      start: activeUntil,
      end: d('2028-01-31T00:00:00Z'),
    });
  });

  it('đã hết hạn 30 ngày: tính lại từ hôm nay', () => {
    expect(nextPeriod(d('2026-09-23T00:00:00Z'), d('2026-10-23T00:00:00Z')).start).toEqual(
      d('2026-10-23T00:00:00Z'),
    );
  });

  it('năm nhuận: 29/02 + 1 năm = 28/02', () => {
    expect(addOneYear(d('2028-02-29T05:00:00Z'))).toEqual(d('2029-02-28T05:00:00Z'));
  });
});
