import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { processImage } from '@/lib/media/process-image';
import { getIntSetting, getSetting } from '@/lib/settings';
import { CATEGORIES, getKiotByOwner, isKiotActive } from '@/modules/kiot';
import { imageCostVnd, providers, textCostVnd } from './config';
import { drivers } from './drivers';
import { buildCopyPrompt, buildImagePrompts, COPY_SCHEMA, parseCopy, type ProductCopy } from './prompt';
import { AI_STYLE_IDS } from './styles';
import { monthlyUsage, recordUsage, usedToday, type AiKind } from './usage';

export type AiError = 'NOT_OWNER' | 'DISABLED' | 'DAILY_LIMIT' | 'BUDGET' | 'AI_ERROR';
export type AiInputError = { ok: false; error: 'INVALID_INPUT'; fields: Record<string, string> };
export type StoredImage = { id: string; url: string; thumbUrl: string };

const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

const copyInput = z.object({
  name: z.string().trim().min(2, 'Tên sản phẩm cần ít nhất 2 ký tự').max(120, 'Tên tối đa 120 ký tự'),
  category: z.enum(CATEGORY_SLUGS, { error: 'Chọn danh mục' }),
  note: z.string().trim().max(300, 'Ghi chú tối đa 300 ký tự').default(''),
});
const drawInput = copyInput.extend({ style: z.enum(AI_STYLE_IDS, { error: 'Chọn phong cách ảnh' }) });

function invalid(error: z.ZodError): AiInputError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0])] ??= issue.message;
  return { ok: false, error: 'INVALID_INPUT', fields };
}

export async function aiStatus(): Promise<{
  text: boolean;
  image: boolean;
  enabled: boolean;
  budgetLeftVnd: number;
}> {
  const [enabled, usage] = await Promise.all([getSetting('ai_enabled'), monthlyUsage()]);
  return {
    ...providers(),
    enabled: enabled === 'true',
    budgetLeftVnd: Math.max(0, usage.budgetVnd - usage.usedVnd),
  };
}

export async function aiQuota(userId: string): Promise<{ textLeft: number; imageLeft: number }> {
  const [textMax, imageMax, text, image] = await Promise.all([
    getIntSetting('ai_text_per_day'),
    getIntSetting('ai_image_per_day'),
    usedToday(userId, 'text'),
    usedToday(userId, 'image'),
  ]);
  return { textLeft: Math.max(0, textMax - text), imageLeft: Math.max(0, imageMax - image) };
}

export async function isStudioOwner(userId: string): Promise<boolean> {
  const kiot = await getKiotByOwner(userId);
  return Boolean(kiot && isKiotActive(kiot));
}

// Một người chỉ chạy 1 việc AI mỗi loại cùng lúc (bấm 2 lần không vượt lượt). Web chạy 1 tiến trình nên giữ trong RAM.
const inFlight = new Set<string>();

// Kiểm tra theo thứ tự: chủ Kiot → AI đang bật và có khoá → ngân sách tháng → lượt trong ngày (SPEC-ai.md mục 1, 8).
async function gate(userId: string, kind: AiKind): Promise<AiError | null> {
  if (!(await isStudioOwner(userId))) return 'NOT_OWNER';
  const status = await aiStatus();
  if (!status.enabled || !status[kind]) return 'DISABLED';
  if (status.budgetLeftVnd <= 0) return 'BUDGET';
  const quota = await aiQuota(userId);
  if ((kind === 'text' ? quota.textLeft : quota.imageLeft) <= 0) return 'DAILY_LIMIT';
  return null;
}

async function exclusive<T>(key: string, busy: T, run: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return busy;
  inFlight.add(key);
  try {
    return await run();
  } finally {
    inFlight.delete(key);
  }
}

export async function writeProductCopy(
  userId: string,
  raw: { name: string; category: string; note?: string },
): Promise<{ ok: true; copy: ProductCopy } | { ok: false; error: AiError } | AiInputError> {
  const parsed = copyInput.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const blocked = await gate(userId, 'text');
  if (blocked) return { ok: false, error: blocked };
  return exclusive(`text:${userId}`, { ok: false as const, error: 'AI_ERROR' as const }, async () => {
    const prompt = buildCopyPrompt(parsed.data);
    const result = await drivers().generateText({ ...prompt, schema: COPY_SCHEMA });
    const copy = result.ok ? parseCopy(result.text) : null;
    const usdRate = await getIntSetting('usd_vnd_rate');
    await recordUsage({
      userId,
      kind: 'text',
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costVnd: textCostVnd(result.model, result.inputTokens, result.outputTokens, usdRate),
      ok: Boolean(copy),
    });
    if (!copy) {
      console.error(`[ai] viết chữ thất bại: ${result.ok ? 'sai định dạng' : result.reason}`);
      return { ok: false as const, error: 'AI_ERROR' as const };
    }
    return { ok: true as const, copy };
  });
}

export async function drawProductImages(
  userId: string,
  raw: { name: string; category: string; note?: string; style: string },
): Promise<{ ok: true; images: StoredImage[] } | { ok: false; error: AiError } | AiInputError> {
  const parsed = drawInput.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const blocked = await gate(userId, 'image');
  if (blocked) return { ok: false, error: blocked };
  return exclusive(`image:${userId}`, { ok: false as const, error: 'AI_ERROR' as const }, async () => {
    const d = drivers();
    const results = await Promise.all(buildImagePrompts(parsed.data).map((p) => d.drawImage(p)));
    const images: StoredImage[] = [];
    for (const r of results) {
      if (!r.ok) continue;
      const stored = await storeImage(userId, r.data, parsed.data.style);
      if (stored) images.push(stored);
    }
    // Tính tiền theo số ảnh model đã trả về (kể cả ảnh hỏng không lưu được).
    const billed = results.filter((r) => r.ok).length;
    await recordUsage({
      userId,
      kind: 'image',
      model: d.imageModel,
      images: billed,
      costVnd: imageCostVnd(d.imageModel, billed, await getIntSetting('usd_vnd_rate')),
      ok: images.length > 0,
    });
    if (images.length === 0) {
      const reasons = results.map((r) => (r.ok ? 'ảnh hỏng' : r.reason)).join(', ');
      console.error(`[ai] vẽ ảnh thất bại: ${reasons}`);
      return { ok: false as const, error: 'AI_ERROR' as const };
    }
    return { ok: true as const, images };
  });
}

// Ảnh AI đi qua cùng bước xử lý như ảnh người bán tải lên (kiểm định dạng, WebP 1200px + 400px, bỏ metadata).
async function storeImage(userId: string, data: Buffer, style: string): Promise<StoredImage | null> {
  const processed = await processImage(data);
  if (!processed.ok) return null;
  const t = now();
  const key = `ai/${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${randomBytes(12).toString('base64url')}`;
  const store = imageStore();
  const url = await store.save(`${key}.webp`, processed.main);
  const thumbUrl = await store.save(`${key}-400.webp`, processed.thumb);
  const row = await db.aiImage.create({
    data: { userId, url, thumbUrl, style, createdAt: t },
    select: { id: true, url: true, thumbUrl: true },
  });
  return row;
}

// Nút "Thử kết nối" ở /admin/ai: gọi AI thật 1 lần với dữ liệu mẫu để CEO biết khoá và model đúng chưa.
// Ghi chi phí như mọi lần gọi (khoảng 20đ cho chữ, 1.000đ cho 1 ảnh), không trừ lượt của chủ Kiot.
export async function aiSelfTest(
  adminId: string,
  kind: AiKind,
): Promise<{ ok: true; detail: string } | { ok: false; detail: string }> {
  if (!providers()[kind]) return { ok: false, detail: 'Chưa có khoá API trong .env' };
  const d = drivers();
  const usdRate = await getIntSetting('usd_vnd_rate');
  if (kind === 'text') {
    const prompt = buildCopyPrompt({ name: 'Cà phê phin Đà Lạt', category: 'thuc-pham-dac-san', note: '' });
    const r = await d.generateText({ ...prompt, schema: COPY_SCHEMA });
    const copy = r.ok ? parseCopy(r.text) : null;
    await recordUsage({
      userId: adminId,
      kind,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costVnd: textCostVnd(r.model, r.inputTokens, r.outputTokens, usdRate),
      ok: Boolean(copy),
    });
    if (copy) return { ok: true, detail: `${r.model}: "${copy.intro}"` };
    return { ok: false, detail: `${r.model}: ${r.ok ? 'trả sai định dạng' : r.reason}` };
  }
  const [prompt] = buildImagePrompts({
    name: 'Cà phê phin Đà Lạt',
    category: 'thuc-pham-dac-san',
    style: 'photo',
    note: '',
  });
  const r = await d.drawImage(prompt!);
  const processed = r.ok ? await processImage(r.data) : null;
  await recordUsage({
    userId: adminId,
    kind,
    model: d.imageModel,
    images: r.ok ? 1 : 0,
    costVnd: imageCostVnd(d.imageModel, r.ok ? 1 : 0, usdRate),
    ok: Boolean(processed?.ok),
  });
  if (processed?.ok)
    return { ok: true, detail: `${d.imageModel}: vẽ được ảnh ${processed.width}×${processed.height}` };
  return { ok: false, detail: `${d.imageModel}: ${r.ok ? 'ảnh trả về không đọc được' : r.reason}` };
}
