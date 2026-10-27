// 5 phong cách ảnh như V4 (SPEC-ai.md mục 2). `prompt` là mô tả gửi cho model vẽ ảnh (tiếng Anh cho ổn định).
export const AI_STYLES = [
  {
    id: 'flat',
    name: 'Flat Vector',
    prompt: 'flat vector illustration, simple clean shapes, soft pastel colors, plain light background',
  },
  {
    id: '3d',
    name: '3D Isometric',
    prompt: '3D isometric render, soft studio lighting, smooth materials, plain soft gradient background',
  },
  {
    id: 'photo',
    name: 'Photo Realistic',
    prompt:
      'professional product photograph, natural soft light, shallow depth of field, plain clean background',
  },
  {
    id: 'sketch',
    name: 'Hand Sketch',
    prompt: 'hand-drawn pencil and ink sketch with a light watercolor wash, on plain white paper',
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    prompt: 'dark plain background with vivid neon glow rim lighting in magenta and orange, futuristic mood',
  },
] as const;

export type AiStyleId = (typeof AI_STYLES)[number]['id'];

export const AI_STYLE_IDS = AI_STYLES.map((s) => s.id) as [AiStyleId, ...AiStyleId[]];

export const IMAGES_PER_DRAW = 4;
