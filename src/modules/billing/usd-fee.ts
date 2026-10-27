import { alertCeo } from '@/lib/alerts';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { formatVnd } from '@/lib/format';
import { getIntSetting, setSetting } from '@/lib/settings';
import { invalidateCached } from '@/lib/ttl-cache';
import { getKiotFee } from './billing';

// Giá Kiot 1 USD/năm (SPEC-billing.md bổ sung 27/10): CEO đặt giá bằng USD; mỗi sáng lấy tỷ giá bán USD của
// Vietcombank, quy ra VNĐ làm tròn tới 1.000đ. Web chỉ hiện VNĐ. QR đã tạo giữ giá lúc tạo (giá chụp vào intent).
export const VCB_RATE_URL = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
export const MAX_DAILY_CHANGE = 0.1; // lệch hơn 10% thì không tự áp dụng
const MIN_FEE_VND = 2_000;

// Đọc giá bán USD trong file XML tỷ giá công khai của Vietcombank:
// <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="25,950.00" Transfer="25,980.00" Sell="26,340.00" />
export function parseVcbUsdSell(xml: string): number | null {
  const tag = /<Exrate\b[^>]*\bCurrencyCode="USD"[^>]*>/i.exec(xml)?.[0];
  const sell = tag ? /\bSell="([\d.,]+)"/i.exec(tag)?.[1] : undefined;
  if (!sell) return null;
  const rate = Math.round(Number(sell.replace(/,/g, '')));
  // Khoảng hợp lý cho 1 USD (chặn số đọc sai, vd. mất dấu phân cách).
  return Number.isFinite(rate) && rate >= 10_000 && rate <= 100_000 ? rate : null;
}

export function feeFromRate(rate: number, usdCents: number): number {
  return Math.max(MIN_FEE_VND, Math.round((rate * usdCents) / 100 / 1000) * 1000);
}

async function applyFee(fee: number, rate: number, actorId: string | null) {
  await setSetting('kiot_fee_vnd', String(fee), actorId);
  await setSetting('usd_vnd_rate', String(rate), actorId);
  invalidateCached('kiot-fee');
}

export type RateUpdate =
  | { ok: true; applied: boolean; rate: number; feeVnd: number }
  | { ok: false; reason: string };

// Cron 7:00 mỗi sáng (và nút "Cập nhật tỷ giá ngay" ở /admin/cai-dat). Lỗi thì giữ giá gần nhất, mai thử lại.
export async function updateKiotFeeFromRate(
  opts: { fetchImpl?: typeof fetch; url?: string } = {},
): Promise<RateUpdate> {
  let rate: number | null = null;
  try {
    const res = await (opts.fetchImpl ?? fetch)(opts.url ?? VCB_RATE_URL, {
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rate = parseVcbUsdSell(await res.text());
    if (!rate) throw new Error('không đọc được giá bán USD');
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[billing] không lấy được tỷ giá Vietcombank: ${reason}`);
    return { ok: false, reason };
  }

  const [usdCents, oldFee] = await Promise.all([getIntSetting('kiot_fee_usd_cents'), getKiotFee()]);
  const newFee = feeFromRate(rate, usdCents);
  const applied = oldFee === 0 || Math.abs(newFee - oldFee) / oldFee <= MAX_DAILY_CHANGE;
  await db.kiotFeeRateLog.create({
    data: {
      source: 'vietcombank',
      rate,
      usdCents,
      oldFeeVnd: oldFee,
      newFeeVnd: newFee,
      applied,
      note: applied ? null : 'Lệch hơn 10% so với giá đang dùng — chờ CEO xem',
      createdAt: now(),
    },
  });
  if (!applied) {
    await alertCeo(
      'kiot_fee_rate',
      `Tỷ giá Vietcombank ${formatVnd(rate)}/USD cho giá Kiot ${formatVnd(newFee)}, lệch hơn 10% so với giá đang thu ` +
        `${formatVnd(oldFee)}. Hệ thống giữ giá cũ. Nếu đúng, vào /admin/cai-dat lưu lại giá USD để áp dụng.`,
    );
    return { ok: true, applied: false, rate, feeVnd: oldFee };
  }
  if (newFee !== oldFee || String(rate) !== String(await getIntSetting('usd_vnd_rate')))
    await applyFee(newFee, rate, null);
  return { ok: true, applied: true, rate, feeVnd: newFee };
}

// CEO đổi giá USD ở /admin: áp dụng ngay theo tỷ giá đang dùng (CEO chủ động nên không chặn 10%).
export async function setKiotFeeUsd(usdCents: number, adminId: string): Promise<void> {
  if (!Number.isInteger(usdCents) || usdCents < 1 || usdCents > 100_000)
    throw new Error('Giá Kiot phải từ 0,01 đến 1.000 USD');
  const [rate, oldFee] = await Promise.all([getIntSetting('usd_vnd_rate'), getKiotFee()]);
  const newFee = feeFromRate(rate, usdCents);
  await setSetting('kiot_fee_usd_cents', String(usdCents), adminId);
  await applyFee(newFee, rate, adminId);
  await db.kiotFeeRateLog.create({
    data: {
      source: 'admin',
      rate,
      usdCents,
      oldFeeVnd: oldFee,
      newFeeVnd: newFee,
      applied: true,
      note: `CEO đổi giá thành ${(usdCents / 100).toFixed(2)} USD`,
      createdAt: now(),
    },
  });
}

export function recentFeeRates(take = 10) {
  return db.kiotFeeRateLog.findMany({ orderBy: { createdAt: 'desc' }, take });
}
