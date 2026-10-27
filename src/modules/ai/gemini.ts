import type { ImageResult } from './drivers';

// Gọi Google Gemini (model tạo ảnh) bằng fetch — mỗi lần gọi 1 ảnh vuông. Khoá chỉ nằm trong header.
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

type Options = { apiKey: string; model: string; timeoutMs: number; fetchImpl?: typeof fetch };

type Part = {
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};
type GenerateResponse = {
  candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function geminiDraw(prompt: string, opts: Options): Promise<ImageResult> {
  if (!opts.apiKey) return { ok: false, reason: 'no_key' };
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(
      `${GEMINI_BASE}/${encodeURIComponent(opts.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs),
      },
    );
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { status?: string } } | null;
    console.error(`[ai] Gemini trả lỗi ${res.status} ${body?.error?.status ?? ''}`.trim());
    return { ok: false, reason: `http_${res.status}` };
  }
  const data = (await res.json().catch(() => null)) as GenerateResponse | null;
  if (data?.promptFeedback?.blockReason) return { ok: false, reason: 'blocked' };
  for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
    const b64 = part.inlineData?.data ?? part.inline_data?.data;
    if (b64) return { ok: true, data: Buffer.from(b64, 'base64') };
  }
  return { ok: false, reason: data?.candidates?.[0]?.finishReason ?? 'no_image' };
}
