import type { TextRequest, TextResult } from './drivers';

// Gọi Claude (Anthropic Messages API) bằng fetch — SPEC-ai.md: không thêm thư viện npm. Khoá chỉ nằm trong header,
// không bao giờ ghi log hay trả về trình duyệt.
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2026-10-21';

type Options = { apiKey: string; model: string; timeoutMs: number; fetchImpl?: typeof fetch };

type MessagesResponse = {
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

export async function claudeGenerate(req: TextRequest, opts: Options): Promise<TextResult> {
  const fail = (reason: string, inputTokens = 0, outputTokens = 0): TextResult => ({
    ok: false,
    reason,
    model: opts.model,
    inputTokens,
    outputTokens,
  });
  if (!opts.apiKey) return fail('no_key');
  let res: Response;
  try {
    res = await (opts.fetchImpl ?? fetch)(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model,
        // Có chỗ cho phần suy nghĩ của model (tính vào max_tokens) + JSON khoảng 1.000 token.
        max_tokens: 6000,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
        // Việc ngắn, rõ: suy nghĩ ít cho nhanh và rẻ; JSON đúng khuôn nhờ structured outputs.
        output_config: { effort: 'low', format: { type: 'json_schema', schema: req.schema } },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (e) {
    return fail(e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  if (!res.ok) {
    // Chỉ ghi mã lỗi và loại lỗi, không ghi nội dung yêu cầu hay khoá.
    const body = (await res.json().catch(() => null)) as { error?: { type?: string } } | null;
    console.error(`[ai] Claude trả lỗi ${res.status} ${body?.error?.type ?? ''}`.trim());
    return fail(`http_${res.status}`);
  }
  const data = (await res.json().catch(() => null)) as MessagesResponse | null;
  const u = data?.usage ?? {};
  const inputTokens =
    (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  const outputTokens = u.output_tokens ?? 0;
  if (!data) return fail('bad_response');
  // Từ chối vì an toàn hoặc hết max_tokens giữa chừng: JSON có thể không đủ, không dùng.
  if (data.stop_reason === 'refusal' || data.stop_reason === 'max_tokens')
    return fail(data.stop_reason, inputTokens, outputTokens);
  // Câu trả lời có thể mở đầu bằng khối "thinking": chỉ lấy các khối text.
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  if (!text) return fail('empty', inputTokens, outputTokens);
  return { ok: true, text, model: opts.model, inputTokens, outputTokens };
}
