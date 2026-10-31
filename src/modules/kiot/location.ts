import { db } from '@/lib/db';
import { validLatLng } from './geo';

// Vị trí Kiot (SPEC-kiot.md V5.1): ghim chính xác chỉ chủ Kiot và admin thấy; nơi công khai chỉ có khoảng cách hoặc điểm
// làm tròn ~500m, trừ khi chủ Kiot bật "Hiện vị trí cửa hàng chính xác". pin = null: bỏ ghim, dùng tâm tỉnh;
// không truyền pin: giữ ghim cũ.
export async function setKiotLocation(
  ownerId: string,
  input: { pin?: { lat: number; lng: number } | null; showExact: boolean },
): Promise<{ ok: true } | { ok: false; error: 'NO_KIOT' | 'INVALID' }> {
  const kiot = await db.kiot.findUnique({ where: { ownerId }, select: { id: true } });
  if (!kiot) return { ok: false, error: 'NO_KIOT' };
  if (input.pin && !validLatLng(input.pin.lat, input.pin.lng)) return { ok: false, error: 'INVALID' };
  await db.kiot.update({
    where: { id: kiot.id },
    data:
      input.pin === undefined
        ? { showExactLocation: input.showExact }
        : input.pin
          ? { lat: input.pin.lat, lng: input.pin.lng, geoSource: 'pin', showExactLocation: input.showExact }
          : { lat: null, lng: null, geoSource: 'province', showExactLocation: input.showExact },
  });
  return { ok: true };
}
