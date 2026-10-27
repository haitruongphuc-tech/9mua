import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { env } from '@/lib/env';
import { claudeGenerate } from './claude';
import { IMAGE_TIMEOUT_MS, TEXT_TIMEOUT_MS } from './config';
import { geminiDraw } from './gemini';
import { TRANSLATION_LANGS } from './prompt';

// Hai đầu gọi AI. Bản thật gọi Anthropic/Google bằng fetch; bản giả (test, E2E) trả kết quả cố định, không tốn tiền.
export type TextRequest = { system: string; user: string; schema: object };
export type TextResult =
  | { ok: true; text: string; model: string; inputTokens: number; outputTokens: number }
  | { ok: false; reason: string; model: string; inputTokens: number; outputTokens: number };
export type ImageResult = { ok: true; data: Buffer } | { ok: false; reason: string };

export interface AiDrivers {
  textModel: string;
  imageModel: string;
  generateText(req: TextRequest): Promise<TextResult>;
  drawImage(prompt: string): Promise<ImageResult>;
}

function liveDrivers(): AiDrivers {
  const e = env();
  return {
    textModel: e.AI_TEXT_MODEL,
    imageModel: e.AI_IMAGE_MODEL,
    generateText: (req) =>
      claudeGenerate(req, {
        apiKey: e.ANTHROPIC_API_KEY ?? '',
        model: e.AI_TEXT_MODEL,
        timeoutMs: TEXT_TIMEOUT_MS,
      }),
    drawImage: (prompt) =>
      geminiDraw(prompt, {
        apiKey: e.GEMINI_API_KEY ?? '',
        model: e.AI_IMAGE_MODEL,
        timeoutMs: IMAGE_TIMEOUT_MS,
      }),
  };
}

// Bản giả: chữ dựng từ đúng tên sản phẩm gửi lên; ảnh là ô màu theo nội dung prompt (4 prompt → 4 màu khác nhau).
export function fakeDrivers(): AiDrivers {
  return {
    textModel: 'fake-text',
    imageModel: 'fake-image',
    async generateText(req) {
      const name = /Tên: (.*)/.exec(req.user)?.[1]?.trim() ?? 'Sản phẩm';
      const copy = {
        intro: `${name} chất lượng, đóng gói cẩn thận, giao tận nơi.`,
        sections: [
          { title: 'Điểm nổi bật', points: [`${name} được chọn lọc kỹ.`, 'Đóng gói chắc chắn.'] },
          { title: 'Cách dùng', points: ['Dùng ngay sau khi mở.', 'Bảo quản nơi khô ráo.'] },
        ],
        hashtags: ['9mua', 'hangviet', 'muasam', 'quatang', 'chuakiot'],
        translations: Object.fromEntries(TRANSLATION_LANGS.map((l) => [l, `${name} (${l})`])),
      };
      return {
        ok: true,
        text: JSON.stringify(copy),
        model: 'fake-text',
        inputTokens: 600,
        outputTokens: 900,
      };
    },
    async drawImage(prompt) {
      const h = createHash('sha256').update(prompt).digest();
      const data = await sharp({
        create: { width: 1024, height: 1024, channels: 3, background: { r: h[0]!, g: h[1]!, b: h[2]! } },
      })
        .png()
        .toBuffer();
      return { ok: true, data };
    },
  };
}

let override: AiDrivers | null = null;

// Chỉ test dùng: thay driver để giả lập AI lỗi, AI trả sai định dạng…
export function setDriversForTest(d: AiDrivers | null): void {
  override = d;
}

export function drivers(): AiDrivers {
  if (override) return override;
  return env().AI_DRIVER === 'fake' ? fakeDrivers() : liveDrivers();
}
