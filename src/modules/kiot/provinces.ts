// 34 tỉnh/thành sau sắp xếp đơn vị hành chính có hiệu lực từ 01/07/2025. slug dùng trên URL Chợ (?tinh=...).
export const PROVINCES = [
  { slug: 'ha-noi', name: 'Hà Nội' },
  { slug: 'tp-ho-chi-minh', name: 'TP. Hồ Chí Minh' },
  { slug: 'hai-phong', name: 'Hải Phòng' },
  { slug: 'da-nang', name: 'Đà Nẵng' },
  { slug: 'can-tho', name: 'Cần Thơ' },
  { slug: 'hue', name: 'Huế' },
  { slug: 'an-giang', name: 'An Giang' },
  { slug: 'bac-ninh', name: 'Bắc Ninh' },
  { slug: 'ca-mau', name: 'Cà Mau' },
  { slug: 'cao-bang', name: 'Cao Bằng' },
  { slug: 'dak-lak', name: 'Đắk Lắk' },
  { slug: 'dien-bien', name: 'Điện Biên' },
  { slug: 'dong-nai', name: 'Đồng Nai' },
  { slug: 'dong-thap', name: 'Đồng Tháp' },
  { slug: 'gia-lai', name: 'Gia Lai' },
  { slug: 'ha-tinh', name: 'Hà Tĩnh' },
  { slug: 'hung-yen', name: 'Hưng Yên' },
  { slug: 'khanh-hoa', name: 'Khánh Hòa' },
  { slug: 'lai-chau', name: 'Lai Châu' },
  { slug: 'lam-dong', name: 'Lâm Đồng' },
  { slug: 'lang-son', name: 'Lạng Sơn' },
  { slug: 'lao-cai', name: 'Lào Cai' },
  { slug: 'nghe-an', name: 'Nghệ An' },
  { slug: 'ninh-binh', name: 'Ninh Bình' },
  { slug: 'phu-tho', name: 'Phú Thọ' },
  { slug: 'quang-ngai', name: 'Quảng Ngãi' },
  { slug: 'quang-ninh', name: 'Quảng Ninh' },
  { slug: 'quang-tri', name: 'Quảng Trị' },
  { slug: 'son-la', name: 'Sơn La' },
  { slug: 'tay-ninh', name: 'Tây Ninh' },
  { slug: 'thai-nguyen', name: 'Thái Nguyên' },
  { slug: 'thanh-hoa', name: 'Thanh Hóa' },
  { slug: 'tuyen-quang', name: 'Tuyên Quang' },
  { slug: 'vinh-long', name: 'Vĩnh Long' },
] as const;

export type ProvinceSlug = (typeof PROVINCES)[number]['slug'];

export function provinceName(slug: string | null | undefined): string | null {
  return PROVINCES.find((p) => p.slug === slug)?.name ?? null;
}
