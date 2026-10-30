import { describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { getSetting, setSetting } from '@/lib/settings';
import { getKiotFee } from './index';
import { parseVcbUsdSell, setKiotFeeUsd, updateKiotFeeFromRate } from './usd-fee';

const xml = (sell: string) => `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<ExrateList>
  <DateTime>10/27/2026 7:30:00 AM</DateTime>
  <Exrate CurrencyCode="AUD" CurrencyName="AUSTRALIAN DOLLAR" Buy="16,123.45" Transfer="16,286.31" Sell="16,808.43" />
  <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="25,950.00" Transfer="25,980.00" Sell="${sell}" />
  <Source>Joint Stock Commercial Bank for Foreign Trade of Vietnam - Vietcombank</Source>
</ExrateList>`;

const fetchOf = (body: string, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(body, { status }));

describe('đọc tỷ giá Vietcombank', () => {
  it('lấy giá bán USD, bỏ dấu phẩy, làm tròn tới đồng', () => {
    expect(parseVcbUsdSell(xml('26,340.00'))).toBe(26_340);
    expect(parseVcbUsdSell(xml('26,340.60'))).toBe(26_341);
  });

  it('thiếu USD, số lạ hoặc ngoài khoảng hợp lý thì trả null', () => {
    expect(parseVcbUsdSell('<ExrateList></ExrateList>')).toBeNull();
    expect(parseVcbUsdSell(xml('-'))).toBeNull();
    expect(parseVcbUsdSell(xml('263.40'))).toBeNull();
    expect(parseVcbUsdSell('không phải XML')).toBeNull();
  });
});

describe('giá Kiot 1 USD/năm theo tỷ giá (SPEC-billing.md bổ sung 27/10)', () => {
  it('mỗi sáng: giá USD × tỷ giá bán, làm tròn tới 1.000đ; lưu tỷ giá và ghi sổ', async () => {
    const r = await updateKiotFeeFromRate({ fetchImpl: fetchOf(xml('26,640.00')) });
    expect(r).toMatchObject({ ok: true, applied: true, rate: 26_640, feeVnd: 27_000 });
    expect(await getKiotFee()).toBe(27_000);
    expect(await getSetting('usd_vnd_rate')).toBe('26640');
    expect(await db.kiotFeeRateLog.findFirstOrThrow()).toMatchObject({
      source: 'vietcombank',
      rate: 26_640,
      usdCents: 100,
      oldFeeVnd: 26_000,
      newFeeVnd: 27_000,
      applied: true,
    });
  });

  it('lấy tỷ giá lỗi thì giữ giá cũ, không ghi gì', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await updateKiotFeeFromRate({ fetchImpl: fetchOf('lỗi', 503) })).toMatchObject({ ok: false });
    expect(await updateKiotFeeFromRate({ fetchImpl: fetchOf('<html>bảo trì</html>') })).toMatchObject({
      ok: false,
    });
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await updateKiotFeeFromRate({ fetchImpl: offline })).toMatchObject({ ok: false });
    expect(await getKiotFee()).toBe(26_000);
    expect(await db.kiotFeeRateLog.count()).toBe(0);
    vi.restoreAllMocks();
  });

  it('giá mới lệch hơn 10% thì không áp dụng, ghi sổ và báo CEO', async () => {
    const r = await updateKiotFeeFromRate({ fetchImpl: fetchOf(xml('30,000.00')) });
    expect(r).toMatchObject({ ok: true, applied: false, feeVnd: 26_000 });
    expect(await getKiotFee()).toBe(26_000);
    expect(await getSetting('usd_vnd_rate')).toBe('26500');
    expect(await db.kiotFeeRateLog.findFirstOrThrow()).toMatchObject({ applied: false, newFeeVnd: 30_000 });
    expect(await db.alertEvent.count({ where: { kind: 'kiot_fee_rate' } })).toBe(1);
  });

  it('CEO đổi giá USD: áp dụng ngay theo tỷ giá đang dùng, ghi sổ nguồn admin', async () => {
    await setSetting('usd_vnd_rate', '26340', null);
    await setKiotFeeUsd(200, 'admin-1');
    expect(await getSetting('kiot_fee_usd_cents')).toBe('200');
    expect(await getKiotFee()).toBe(53_000);
    expect(await db.kiotFeeRateLog.findFirstOrThrow()).toMatchObject({
      source: 'admin',
      usdCents: 200,
      oldFeeVnd: 26_000,
      newFeeVnd: 53_000,
      applied: true,
    });
    // Giá USD thấp đến mức dưới 2.000đ thì vẫn giữ tối thiểu 2.000đ.
    await setKiotFeeUsd(5, 'admin-1');
    expect(await getKiotFee()).toBe(2_000);
  });

  it('sổ đổi giá chỉ thêm, không sửa được', async () => {
    await updateKiotFeeFromRate({ fetchImpl: fetchOf(xml('26,340.00')) });
    const row = await db.kiotFeeRateLog.findFirstOrThrow();
    await expect(db.kiotFeeRateLog.update({ where: { id: row.id }, data: { rate: 1 } })).rejects.toThrow();
  });
});
