// Bộ lọc màu và làm đẹp (SPEC-creator.md V5.5 mục 2–3) — phần dùng chung cho trình duyệt và máy chủ: tên bộ lọc và
// bản xem trước bằng CSS filter. Bộ lọc ffmpeg tương ứng nằm ở module creator (look.ts).
export const LOOKS = ['goc', 'sang', 'am', 'lanh', 'co-dien', 'den-trang', 'ruc', 'mem'] as const;
export type Look = (typeof LOOKS)[number];
export const isLook = (v: unknown): v is Look => LOOKS.includes(v as Look);
export const MAX_BEAUTY = 3;

export const CSS_LOOKS: Record<Look, string> = {
  goc: 'none',
  sang: 'brightness(1.12) contrast(1.05)',
  am: 'sepia(0.25) saturate(1.15)',
  lanh: 'hue-rotate(-12deg) saturate(1.05) brightness(1.03)',
  'co-dien': 'sepia(0.5) contrast(0.95)',
  'den-trang': 'grayscale(1)',
  ruc: 'saturate(1.5) contrast(1.1)',
  mem: 'contrast(0.9) brightness(1.05) saturate(0.9)',
};

// Xem trước làm đẹp trên trình duyệt (gần đúng với ffmpeg).
export const cssBeauty = (level: number) =>
  level > 0 ? `blur(${(level * 0.25).toFixed(2)}px) brightness(${(1 + level * 0.02).toFixed(2)})` : '';
