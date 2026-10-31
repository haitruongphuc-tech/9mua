import { Prisma } from '@prisma/client';
import { PROVINCES } from './provinces';

// Tâm tỉnh (trụ sở UBND tỉnh sau sắp xếp 01/07/2025), dùng khi Kiot chưa đặt ghim (SPEC-kiot.md V5.1 mục 3).
export const PROVINCE_CENTERS: Record<(typeof PROVINCES)[number]['slug'], [number, number]> = {
  'ha-noi': [21.028, 105.854],
  'tp-ho-chi-minh': [10.776, 106.701],
  'hai-phong': [20.845, 106.688],
  'da-nang': [16.054, 108.202],
  'can-tho': [10.045, 105.747],
  hue: [16.463, 107.59],
  'an-giang': [10.012, 105.081],
  'bac-ninh': [21.273, 106.194],
  'ca-mau': [9.177, 105.15],
  'cao-bang': [22.666, 106.258],
  'dak-lak': [12.667, 108.038],
  'dien-bien': [21.386, 103.023],
  'dong-nai': [10.957, 106.843],
  'dong-thap': [10.36, 106.36],
  'gia-lai': [13.776, 109.223],
  'ha-tinh': [18.342, 105.905],
  'hung-yen': [20.646, 106.051],
  'khanh-hoa': [12.238, 109.196],
  'lai-chau': [22.396, 103.458],
  'lam-dong': [11.94, 108.458],
  'lang-son': [21.853, 106.761],
  'lao-cai': [21.705, 104.875],
  'nghe-an': [18.679, 105.681],
  'ninh-binh': [20.251, 105.975],
  'phu-tho': [21.322, 105.402],
  'quang-ngai': [15.121, 108.804],
  'quang-ninh': [20.951, 107.08],
  'quang-tri': [17.468, 106.622],
  'son-la': [21.327, 103.914],
  'tay-ninh': [10.535, 106.413],
  'thai-nguyen': [21.594, 105.848],
  'thanh-hoa': [19.807, 105.776],
  'tuyen-quang': [21.823, 105.214],
  'vinh-long': [10.254, 105.972],
};

export const validLatLng = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 8 &&
  lat <= 24 &&
  lng >= 102 &&
  lng <= 118;

// Khoảng cách haversine (km), dùng cho test và chỗ tính trong JS.
export function distanceKm(a: [number, number], b: [number, number]): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b[0] - a[0]);
  const dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Bảng tâm tỉnh trong SQL: JOIN (VALUES …) pc(slug, lat, lng).
export const provinceCentersSql = Prisma.sql`(VALUES ${Prisma.join(
  Object.entries(PROVINCE_CENTERS).map(
    ([slug, [lat, lng]]) => Prisma.sql`(${slug}, ${lat}::float8, ${lng}::float8)`,
  ),
)}) AS pc(slug, lat, lng)`;

// Vị trí hiệu lực của Kiot k (ghim, không có thì tâm tỉnh) — dùng với LEFT JOIN provinceCentersSql ON pc.slug = k.province.
export const kiotLatSql = Prisma.sql`COALESCE(k.lat, pc.lat)`;
export const kiotLngSql = Prisma.sql`COALESCE(k.lng, pc.lng)`;

// Khoảng cách haversine (km) trong SQL, không cần PostGIS (SPEC-marketplace.md V5.2 mục 3).
export function distanceSql(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`(2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(${kiotLatSql} - ${lat}::float8) / 2), 2)
    + cos(radians(${lat}::float8)) * cos(radians(${kiotLatSql}))
      * power(sin(radians(${kiotLngSql} - ${lng}::float8) / 2), 2)))))`;
}

// Điểm công khai làm tròn khoảng 500m (0,005 độ), trừ khi chủ Kiot bật "Hiện vị trí chính xác".
export const roundPublic = (v: number) => Math.round(v / 0.005) * 0.005;
