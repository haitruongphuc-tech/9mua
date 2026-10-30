// Bộ lọc màu và làm đẹp (SPEC-creator.md V5.5 mục 2–3): bộ lọc ffmpeg máy chủ áp khi xử lý (bản xem trước CSS ở
// src/lib/looks.ts). Làm đẹp chỉ làm mịn và sáng nhẹ TOÀN KHUNG — không nhận diện hay chỉnh khuôn mặt.
import { isLook, MAX_BEAUTY, type Look } from '@/lib/looks';

export { CSS_LOOKS, cssBeauty, isLook, LOOKS, MAX_BEAUTY, type Look } from '@/lib/looks';

const FFMPEG_LOOKS: Record<Look, string | null> = {
  goc: null,
  sang: 'eq=brightness=0.06:contrast=1.05',
  am: 'colorbalance=rs=0.08:gs=0.02:bs=-0.08,eq=saturation=1.1',
  lanh: 'colorbalance=rs=-0.06:bs=0.08,eq=brightness=0.02',
  'co-dien': 'curves=preset=vintage',
  'den-trang': 'hue=s=0',
  ruc: 'eq=saturation=1.5:contrast=1.1',
  mem: 'eq=contrast=0.9:brightness=0.03:saturation=0.9',
};

// Chuỗi bộ lọc ffmpeg cho video (null: không đổi gì). Giá trị lạ thì bỏ qua.
export function lookFilter(look: Look | null | undefined, beauty: number): string | null {
  const parts: string[] = [];
  const level = Number.isInteger(beauty) && beauty > 0 && beauty <= MAX_BEAUTY ? beauty : 0;
  if (level)
    parts.push(
      `hqdn3d=${level * 2}:${level * 2}:${level * 3}:${level * 3}`,
      `eq=brightness=${(level * 0.015).toFixed(3)}`,
    );
  const color = isLook(look) ? FFMPEG_LOOKS[look] : null;
  if (color) parts.push(color);
  return parts.length ? parts.join(',') : null;
}
