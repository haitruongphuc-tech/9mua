// Chỉnh video trước khi đăng (SPEC-creator.md V5.6 mục 1) — phần dùng chung cho trình duyệt và máy chủ: 6 màu chữ,
// 24 nhãn dán của 9MUA, giới hạn. Nhãn dán là chữ in sẵn trên video (tiếng Việt), không dịch.
export const TEXT_COLORS = ['#ffffff', '#111111', '#ff6b00', '#ffd400', '#22c55e', '#3b82f6'] as const;
export const MAX_TEXTS = 5;
export const MAX_TEXT_CHARS = 60;
export const MAX_STICKERS = 10;
export const MAX_CLIPS = 10;

export const STICKERS = [
  { id: 'mua-ngay', label: 'Mua ngay', bg: '#ff6b00' },
  { id: 'giam-gia', label: 'Giảm giá', bg: '#e11d48' },
  { id: 'moi', label: 'Mới', bg: '#22c55e' },
  { id: 'freeship', label: 'Freeship', bg: '#0ea5e9' },
  { id: 'hang-that', label: 'Hàng thật', bg: '#16a34a' },
  { id: 'hot', label: 'Hot', bg: '#ef4444' },
  { id: 'sale', label: 'Sale', bg: '#f43f5e' },
  { id: 'chinh-hang', label: 'Chính hãng', bg: '#2563eb' },
  { id: 'dac-san', label: 'Đặc sản', bg: '#ca8a04' },
  { id: 'tuoi-ngon', label: 'Tươi ngon', bg: '#65a30d' },
  { id: 'ban-chay', label: 'Bán chạy', bg: '#ea580c' },
  { id: 'co-san', label: 'Có sẵn', bg: '#0d9488' },
  { id: 'giao-nhanh', label: 'Giao nhanh', bg: '#7c3aed' },
  { id: 'qua-tang', label: 'Quà tặng', bg: '#db2777' },
  { id: 'combo', label: 'Combo', bg: '#9333ea' },
  { id: 'gia-soc', label: 'Giá sốc', bg: '#dc2626' },
  { id: 'moi-ve', label: 'Mới về', bg: '#059669' },
  { id: 'handmade', label: 'Handmade', bg: '#a16207' },
  { id: 'organic', label: 'Organic', bg: '#4d7c0f' },
  { id: 'nha-lam', label: 'Nhà làm', bg: '#b45309' },
  { id: 'chi-hom-nay', label: 'Chỉ hôm nay', bg: '#be123c' },
  { id: 'so-luong-co-han', label: 'Số lượng có hạn', bg: '#9f1239' },
  { id: 'uu-dai', label: 'Ưu đãi', bg: '#c2410c' },
  { id: 'follow', label: 'Like & Follow', bg: '#ff6b00' },
] as const;
export type StickerId = (typeof STICKERS)[number]['id'];

export type EditText = { text: string; color: string; x: number; y: number; fromSec: number; toSec: number };
export type EditSticker = { id: StickerId; x: number; y: number; fromSec: number; toSec: number };
// Thời gian chữ / nhãn dán tính theo video gốc (như người đăng thấy khi xem trước); máy chủ trừ phần cắt đầu.
export type EditSpec = {
  trimStart: number;
  trimEnd: number | null;
  texts: EditText[];
  stickers: EditSticker[];
};
