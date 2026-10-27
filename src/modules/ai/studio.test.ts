import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { setSetting } from '@/lib/settings';
import { createSeller, createUser } from '../../../tests/helpers/factories';
import { fakeDrivers, setDriversForTest } from './drivers';
import { aiQuota, aiSelfTest, aiStatus, drawProductImages, writeProductCopy } from './studio';
import { monthlyUsage } from './usage';

afterEach(() => setDriversForTest(null));

const input = { name: 'Mực một nắng Hamubay', category: 'thuc-pham-dac-san', note: 'Mực câu Phan Thiết' };
const drawInput = { ...input, style: 'photo' };

describe('AI viết chữ (SPEC-ai.md mục 3, 8)', () => {
  it('chủ Kiot đang hoạt động: nhận mô tả, 5 hashtag, 6 bản dịch; ghi 1 dòng chi phí', async () => {
    const { user } = await createSeller({ active: true });
    const r = await writeProductCopy(user.id, input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.copy.description).toContain('ĐIỂM NỔI BẬT');
    expect(r.copy.hashtags).toHaveLength(5);
    expect(Object.keys(r.copy.translations).sort()).toEqual(['en', 'es', 'fr', 'ja', 'ko', 'zh']);
    const usage = await db.aiUsage.findMany();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      userId: user.id,
      kind: 'text',
      ok: true,
      inputTokens: 600,
      outputTokens: 900,
    });
    expect(usage[0]!.costVnd).toBeGreaterThan(0);
  });

  it('người chưa có Kiot hoặc Kiot chưa kích hoạt bị chặn, không gọi AI', async () => {
    const generateText = vi.fn();
    setDriversForTest({ ...fakeDrivers(), generateText });
    const buyer = await createUser();
    expect(await writeProductCopy(buyer.id, input)).toEqual({ ok: false, error: 'NOT_OWNER' });
    const { user: draftOwner } = await createSeller();
    expect(await writeProductCopy(draftOwner.id, input)).toEqual({ ok: false, error: 'NOT_OWNER' });
    expect(generateText).not.toHaveBeenCalled();
  });

  it('dữ liệu nhập sai thì báo lỗi, không gọi AI', async () => {
    const { user } = await createSeller({ active: true });
    const r = await writeProductCopy(user.id, { ...input, name: 'x', note: 'n'.repeat(301) });
    expect(r).toMatchObject({ ok: false, error: 'INVALID_INPUT' });
    expect(await db.aiUsage.count()).toBe(0);
  });

  it('đủ 10 lượt trong ngày thì chặn; lượt lỗi không bị trừ; sang ngày mới được dùng tiếp', async () => {
    setClock(new Date('2026-10-27T03:00:00Z'));
    const { user } = await createSeller({ active: true });
    setDriversForTest({
      ...fakeDrivers(),
      generateText: async () => ({
        ok: false,
        reason: 'http_529',
        model: 'm',
        inputTokens: 0,
        outputTokens: 0,
      }),
    });
    expect(await writeProductCopy(user.id, input)).toEqual({ ok: false, error: 'AI_ERROR' });
    setDriversForTest(null);
    for (let i = 0; i < 10; i += 1) expect((await writeProductCopy(user.id, input)).ok).toBe(true);
    expect(await writeProductCopy(user.id, input)).toEqual({ ok: false, error: 'DAILY_LIMIT' });
    expect(await aiQuota(user.id)).toMatchObject({ textLeft: 0, imageLeft: 3 });
    advanceClock({ days: 1 });
    expect((await writeProductCopy(user.id, input)).ok).toBe(true);
  });

  it('AI trả sai định dạng: báo lỗi, ghi chi phí (đã tốn tiền) nhưng không trừ lượt', async () => {
    const { user } = await createSeller({ active: true });
    setDriversForTest({
      ...fakeDrivers(),
      generateText: async () => ({
        ok: true,
        text: '{"sai":1}',
        model: 'claude-haiku-5-5',
        inputTokens: 500,
        outputTokens: 700,
      }),
    });
    expect(await writeProductCopy(user.id, input)).toEqual({ ok: false, error: 'AI_ERROR' });
    const row = await db.aiUsage.findFirstOrThrow();
    expect(row).toMatchObject({ ok: false, inputTokens: 500, outputTokens: 700 });
    expect(row.costVnd).toBeGreaterThan(0);
    expect((await aiQuota(user.id)).textLeft).toBe(10);
  });

  it('CEO tắt AI Studio thì chặn', async () => {
    const { user } = await createSeller({ active: true });
    await setSetting('ai_enabled', 'false', null);
    expect(await writeProductCopy(user.id, input)).toEqual({ ok: false, error: 'DISABLED' });
    expect((await aiStatus()).enabled).toBe(false);
  });

  it('chạm ngân sách tháng: tạm dừng, báo CEO một lần; sang tháng sau chạy lại', async () => {
    setClock(new Date('2026-10-20T03:00:00Z'));
    const { user } = await createSeller({ active: true });
    await setSetting('ai_monthly_budget_vnd', '20', null);
    // Mỗi lần viết chữ giả 14đ: lần 1 còn dưới 20đ, lần 2 vượt ngân sách → báo CEO; lần 3 bị chặn.
    expect((await writeProductCopy(user.id, input)).ok).toBe(true);
    expect((await writeProductCopy(user.id, input)).ok).toBe(true);
    expect(await writeProductCopy(user.id, input)).toEqual({ ok: false, error: 'BUDGET' });
    const alerts = await db.alertEvent.findMany({ where: { kind: 'ai_budget' } });
    expect(alerts).toHaveLength(1);
    expect((await aiStatus()).budgetLeftVnd).toBe(0);
    expect(await monthlyUsage()).toEqual({ usedVnd: 28, budgetVnd: 20 });
    setClock(new Date('2026-11-01T03:00:00Z'));
    expect((await writeProductCopy(user.id, input)).ok).toBe(true);
  });

  it('sổ chi phí AI chỉ thêm, không sửa/xoá được (chặn ở database)', async () => {
    const { user } = await createSeller({ active: true });
    await writeProductCopy(user.id, input);
    const row = await db.aiUsage.findFirstOrThrow();
    await expect(db.aiUsage.update({ where: { id: row.id }, data: { costVnd: 0 } })).rejects.toThrow();
    await expect(db.aiUsage.delete({ where: { id: row.id } })).rejects.toThrow();
  });
});

describe('AI vẽ ảnh (SPEC-ai.md mục 4)', () => {
  it('vẽ 4 ảnh, lưu qua kho ảnh, ghi chi phí theo số ảnh; tối đa 3 lần mỗi ngày', async () => {
    const { user } = await createSeller({ active: true });
    const r = await drawProductImages(user.id, drawInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.images).toHaveLength(4);
    expect(r.images[0]!.url).toMatch(/^\/uploads\/ai\/.+\.webp$/);
    expect(await db.aiImage.count({ where: { userId: user.id, style: 'photo' } })).toBe(4);
    expect(await db.aiUsage.findFirstOrThrow()).toMatchObject({ kind: 'image', images: 4, ok: true });
    await drawProductImages(user.id, drawInput);
    await drawProductImages(user.id, drawInput);
    expect(await drawProductImages(user.id, drawInput)).toEqual({ ok: false, error: 'DAILY_LIMIT' });
  });

  it('một phần ảnh lỗi vẫn trả các ảnh vẽ được; lỗi hết thì báo AI_ERROR và không trừ lượt', async () => {
    const { user } = await createSeller({ active: true });
    let n = 0;
    const fake = fakeDrivers();
    setDriversForTest({
      ...fake,
      drawImage: async (p) => ((n += 1) % 2 === 0 ? { ok: false, reason: 'blocked' } : fake.drawImage(p)),
    });
    const r = await drawProductImages(user.id, drawInput);
    expect(r.ok && r.images.length).toBe(2);
    setDriversForTest({
      ...fake,
      drawImage: async () => ({ ok: true, data: Buffer.from('khong-phai-anh') }),
    });
    expect(await drawProductImages(user.id, drawInput)).toEqual({ ok: false, error: 'AI_ERROR' });
    expect((await aiQuota(user.id)).imageLeft).toBe(2);
  });

  it('phong cách không nằm trong 5 kiểu thì báo lỗi nhập', async () => {
    const { user } = await createSeller({ active: true });
    expect(await drawProductImages(user.id, { ...drawInput, style: 'anime' })).toMatchObject({
      ok: false,
      error: 'INVALID_INPUT',
    });
  });
});

describe('nút "Thử kết nối" của CEO', () => {
  it('gọi AI 1 lần mỗi loại, ghi chi phí, không trừ lượt chủ Kiot', async () => {
    const admin = await createUser();
    expect(await aiSelfTest(admin.id, 'text')).toMatchObject({ ok: true });
    expect(await aiSelfTest(admin.id, 'image')).toMatchObject({
      ok: true,
      detail: expect.stringContaining('1024×1024'),
    });
    expect(await db.aiUsage.count({ where: { userId: admin.id } })).toBe(2);
    expect(await db.aiImage.count()).toBe(0);
  });
});
