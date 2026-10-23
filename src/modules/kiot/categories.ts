// 12 danh mục cố định của Chợ 9MUA (SPEC-kiot.md mục 5). slug dùng trên URL: /cho/<slug>.
export const CATEGORIES = [
  { slug: 'thuc-pham-dac-san', name: 'Thực phẩm & Đặc sản', icon: '🍱' },
  { slug: 'thoi-trang', name: 'Thời trang', icon: '👕' },
  { slug: 'my-pham', name: 'Mỹ phẩm', icon: '💄' },
  { slug: 'do-gia-dung', name: 'Đồ gia dụng', icon: '🏠' },
  { slug: 'dien-tu', name: 'Điện tử', icon: '📱' },
  { slug: 'me-va-be', name: 'Mẹ & Bé', icon: '🍼' },
  { slug: 'suc-khoe', name: 'Sức khoẻ', icon: '💊' },
  { slug: 'thu-cong-my-nghe', name: 'Thủ công mỹ nghệ', icon: '🧺' },
  { slug: 'nong-san', name: 'Nông sản', icon: '🌾' },
  { slug: 'sach-van-phong-pham', name: 'Sách & VPP', icon: '📚' },
  { slug: 'thu-cung', name: 'Thú cưng', icon: '🐾' },
  { slug: 'khac', name: 'Khác', icon: '🛍️' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? 'Khác';
}
