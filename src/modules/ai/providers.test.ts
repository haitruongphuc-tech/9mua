import { afterEach, describe, expect, it, vi } from 'vitest';
import { claudeGenerate } from './claude';
import { imageCostVnd, textCostVnd } from './config';
import { geminiDraw } from './gemini';

afterEach(() => vi.restoreAllMocks());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const req = { system: 'hệ thống', user: '<san_pham>Tên: Mực</san_pham>', schema: { type: 'object' } };
const opts = { apiKey: 'sk-ant-bi-mat', model: 'claude-haiku-5-5', timeoutMs: 1000 };

describe('Claude qua fetch', () => {
  it('gửi đúng địa chỉ, header, structured outputs; không gửi temperature; đọc text + usage', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: '{"a":' },
          { type: 'text', text: '1}' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 500, output_tokens: 800, cache_read_input_tokens: 0 },
      }),
    );
    const r = await claudeGenerate(req, { ...opts, fetchImpl });
    expect(r).toEqual({
      ok: true,
      text: '{"a":1}',
      model: 'claude-haiku-5-5',
      inputTokens: 500,
      outputTokens: 800,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-bi-mat');
    expect(headers['anthropic-version']).toBe('2026-10-21');
    const body = JSON.parse(String(init!.body));
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.messages).toEqual([{ role: 'user', content: req.user }]);
    expect(body.output_config).toEqual({
      effort: 'low',
      format: { type: 'json_schema', schema: req.schema },
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('top_p');
  });

  it('từ chối / hết max_tokens / lỗi HTTP / mất mạng đều là lỗi; vẫn trả số token đã tốn; không lộ khoá', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const refusal = vi.fn(async () =>
      json({ content: [], stop_reason: 'refusal', usage: { input_tokens: 100, output_tokens: 5 } }),
    );
    expect(await claudeGenerate(req, { ...opts, fetchImpl: refusal })).toMatchObject({
      ok: false,
      reason: 'refusal',
      inputTokens: 100,
      outputTokens: 5,
    });
    const cut = vi.fn(async () =>
      json({
        content: [{ type: 'text', text: '{"a"' }],
        stop_reason: 'max_tokens',
        usage: { output_tokens: 6000 },
      }),
    );
    expect(await claudeGenerate(req, { ...opts, fetchImpl: cut })).toMatchObject({
      ok: false,
      reason: 'max_tokens',
    });
    const overloaded = vi.fn(async () => json({ type: 'error', error: { type: 'overloaded_error' } }, 529));
    expect(await claudeGenerate(req, { ...opts, fetchImpl: overloaded })).toMatchObject({
      ok: false,
      reason: 'http_529',
    });
    const offline = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await claudeGenerate(req, { ...opts, fetchImpl: offline })).toMatchObject({
      ok: false,
      reason: 'network',
    });
    expect(await claudeGenerate(req, { ...opts, apiKey: '' })).toMatchObject({ ok: false, reason: 'no_key' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('sk-ant-bi-mat');
  });
});

describe('Gemini qua fetch', () => {
  it('gửi đúng model, header, chỉ xin ảnh vuông; đọc ảnh base64', async () => {
    const png = Buffer.from('anh-png');
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({
        candidates: [
          { content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } },
        ],
      }),
    );
    const r = await geminiDraw('vẽ mực', {
      apiKey: 'g-bi-mat',
      model: 'gemini-2.5-flash-image',
      timeoutMs: 1000,
      fetchImpl,
    });
    expect(r).toEqual({ ok: true, data: png });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    );
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('g-bi-mat');
    const body = JSON.parse(String(init!.body));
    expect(body.generationConfig).toEqual({
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '1:1' },
    });
    expect(body.contents[0].parts[0].text).toBe('vẽ mực');
  });

  it('bị chặn hoặc không có ảnh thì báo lỗi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const o = { apiKey: 'k', model: 'm', timeoutMs: 1000 };
    const blocked = vi.fn(async () => json({ promptFeedback: { blockReason: 'SAFETY' } }));
    expect(await geminiDraw('x', { ...o, fetchImpl: blocked })).toEqual({ ok: false, reason: 'blocked' });
    const textOnly = vi.fn(async () =>
      json({ candidates: [{ content: { parts: [{ text: 'không vẽ được' }] }, finishReason: 'STOP' }] }),
    );
    expect(await geminiDraw('x', { ...o, fetchImpl: textOnly })).toEqual({ ok: false, reason: 'STOP' });
    const err = vi.fn(async () => json({ error: { status: 'PERMISSION_DENIED' } }, 403));
    expect(await geminiDraw('x', { ...o, fetchImpl: err })).toEqual({ ok: false, reason: 'http_403' });
  });
});

describe('chi phí ước tính (VNĐ, làm tròn lên)', () => {
  it('viết chữ Haiku dưới 100đ/lần; ảnh khoảng 1.000đ/ảnh; model lạ tính giá cao', () => {
    expect(textCostVnd('claude-haiku-5-5', 800, 1500, 26_500)).toBe(22);
    expect(textCostVnd('claude-haiku-5-5', 800, 1500, 26_500)).toBeLessThan(100);
    expect(imageCostVnd('gemini-2.5-flash-image', 4, 26_500)).toBe(4_134);
    expect(textCostVnd('model-la', 800, 1500, 26_500)).toBeGreaterThan(
      textCostVnd('claude-haiku-5-5', 800, 1500, 26_500),
    );
    expect(imageCostVnd('model-la', 1, 26_500)).toBeGreaterThan(
      imageCostVnd('gemini-2.5-flash-image', 1, 26_500),
    );
  });
});
