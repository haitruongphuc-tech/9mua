import { env } from '@/lib/env';

// Giá theo bảng giá công khai lúc làm (27/10/2026), tính bằng USD. Model lạ thì tính theo giá cao nhất đã biết để
// ngân sách không bị tính thiếu. Giá thật theo hoá đơn của Anthropic và Google (SPEC-ai.md mục 8).
const TEXT_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'fake-text': { input: 0.1, output: 0.5 }, // driver giả (test, E2E): tính như Haiku
};
const TEXT_FALLBACK = { input: 4, output: 20 };

const IMAGE_USD_EACH: Record<string, number> = {
  'gemini-2.5-flash-image': 0.039,
  'fake-image': 0.039,
};
const IMAGE_FALLBACK = 0.134;

export function textCostVnd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  usdRate: number,
): number {
  const p = TEXT_USD_PER_MTOK[model] ?? TEXT_FALLBACK;
  return Math.ceil(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * usdRate);
}

export function imageCostVnd(model: string, images: number, usdRate: number): number {
  return Math.ceil(images * (IMAGE_USD_EACH[model] ?? IMAGE_FALLBACK) * usdRate);
}

export const TEXT_TIMEOUT_MS = 30_000;
export const IMAGE_TIMEOUT_MS = 90_000;

// Phần nào có khoá thì bật phần đó (SPEC-ai.md mục 8). Driver giả luôn bật.
export function providers(): { text: boolean; image: boolean } {
  const e = env();
  if (e.AI_DRIVER === 'fake') return { text: true, image: true };
  return { text: Boolean(e.ANTHROPIC_API_KEY), image: Boolean(e.GEMINI_API_KEY) };
}
