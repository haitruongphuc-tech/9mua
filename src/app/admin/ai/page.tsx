import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { env } from '@/lib/env';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { getAllSettings, requireAdminVerified } from '@/modules/admin';
import { aiStatus, monthlyUsage, recentUsage } from '@/modules/ai';
import type { FlashParams } from '../flash';
import { saveAiSettingsAction, selfTestAction } from './actions';

export const dynamic = 'force-dynamic';

const field = 'h-11 rounded-[14px] border border-white/15 bg-white/10 text-white px-3 text-base';

// AI Studio (SPEC-ai.md mục 8): công tắc, ngân sách tháng, lượt mỗi ngày, chi phí từng lần gọi.
export default async function AdminAiPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [s, params, status, usage, recent] = await Promise.all([
    getAllSettings(),
    searchParams,
    aiStatus(),
    monthlyUsage(),
    recentUsage(),
  ]);
  const e = env();
  const pct = usage.budgetVnd > 0 ? Math.min(100, Math.round((usage.usedVnd / usage.budgetVnd) * 100)) : 100;
  const num = (label: string, name: string, value: string, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm font-bold">
      {label}
      <input
        name={name}
        inputMode="numeric"
        defaultValue={Number(value).toLocaleString('vi-VN')}
        className={field}
      />
      {hint ? <span className="text-xs font-normal text-white/60">{hint}</span> : null}
    </label>
  );
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">AI Studio</h1>
      <Flash ok={params.xong} error={params.loi} />

      <div className="grid gap-3 sm:grid-cols-2" data-testid="ai-providers">
        <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm">
          <p className="font-extrabold">Viết chữ — Claude (Anthropic)</p>
          <p className={status.text ? 'text-green-400' : 'text-red-400'}>
            {status.text ? 'Có khoá' : 'Chưa có ANTHROPIC_API_KEY trong .env'}
          </p>
          <p className="text-white/60">
            Model: {e.AI_TEXT_MODEL}
            {e.AI_DRIVER === 'fake' ? ' (driver giả)' : ''}
          </p>
          <form action={selfTestAction.bind(null, 'text')} className="mt-2">
            <ConfirmSubmit confirm="Gọi Claude thật 1 lần (khoảng 20đ)?" tone="plain" testId="ai-test-text">
              Thử kết nối
            </ConfirmSubmit>
          </form>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm">
          <p className="font-extrabold">Vẽ ảnh — Gemini (Google)</p>
          <p className={status.image ? 'text-green-400' : 'text-red-400'}>
            {status.image ? 'Có khoá' : 'Chưa có GEMINI_API_KEY trong .env'}
          </p>
          <p className="text-white/60">
            Model: {e.AI_IMAGE_MODEL}
            {e.AI_DRIVER === 'fake' ? ' (driver giả)' : ''}
          </p>
          <form action={selfTestAction.bind(null, 'image')} className="mt-2">
            <ConfirmSubmit
              confirm="Gọi Gemini thật để vẽ 1 ảnh (khoảng 1.000đ)?"
              tone="plain"
              testId="ai-test-image"
            >
              Thử kết nối
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      <div
        className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="ai-budget"
      >
        <p className="text-lg font-extrabold">
          Tháng này: {formatVnd(usage.usedVnd)} / {formatVnd(usage.budgetVnd)}
        </p>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full ${pct >= 100 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-white/70">
          {pct >= 100
            ? 'Đã chạm ngân sách: AI tạm dừng tới đầu tháng sau (tăng ngân sách bên dưới để mở lại).'
            : `Còn ${formatVnd(status.budgetLeftVnd)}. Chi phí là ước tính theo bảng giá; số thật xem trên hoá đơn Anthropic và Google.`}
        </p>
      </div>

      <form
        action={saveAiSettingsAction}
        className="flex flex-col gap-4 rounded-[18px] border border-white/10 bg-white/5 p-4"
      >
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            name="ai_enabled"
            defaultChecked={s.ai_enabled === 'true'}
            className="h-5 w-5 accent-brand"
          />
          Bật AI Studio cho chủ Kiot
        </label>
        {num(
          'Ngân sách AI mỗi tháng (đ)',
          'ai_monthly_budget_vnd',
          s.ai_monthly_budget_vnd,
          'Mặc định 500.000đ. Chạm ngân sách thì AI tạm dừng và có email báo.',
        )}
        {num('Lượt viết chữ mỗi chủ Kiot mỗi ngày', 'ai_text_per_day', s.ai_text_per_day, 'Mặc định 10.')}
        {num(
          'Lượt vẽ ảnh (4 ảnh/lượt) mỗi chủ Kiot mỗi ngày',
          'ai_image_per_day',
          s.ai_image_per_day,
          'Mặc định 3.',
        )}
        {num(
          'Tỉ giá USD (đ)',
          'usd_vnd_rate',
          s.usd_vnd_rate,
          'Dùng để quy chi phí AI (tính bằng USD) ra VNĐ.',
        )}
        <ConfirmSubmit confirm="Lưu cài đặt AI Studio?">Lưu cài đặt</ConfirmSubmit>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">50 lần gọi gần nhất</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-white/60">Chưa có lần gọi nào.</p>
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-white/10">
            <table className="w-full text-left text-sm" data-testid="ai-usage">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-3 py-2">Lúc</th>
                  <th className="px-3 py-2">Loại</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Token vào/ra · ảnh</th>
                  <th className="px-3 py-2 text-right">Chi phí</th>
                  <th className="px-3 py-2">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {recent.map((u) => (
                  <tr key={u.id}>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateTimeVN(u.createdAt)}</td>
                    <td className="px-3 py-2">{u.kind === 'text' ? 'Viết chữ' : 'Vẽ ảnh'}</td>
                    <td className="px-3 py-2">{u.model}</td>
                    <td className="px-3 py-2">
                      {u.kind === 'text'
                        ? `${u.inputTokens ?? 0} / ${u.outputTokens ?? 0}`
                        : `${u.images ?? 0} ảnh`}
                    </td>
                    <td className="px-3 py-2 text-right">{formatVnd(u.costVnd)}</td>
                    <td className={`px-3 py-2 ${u.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {u.ok ? 'Được' : 'Lỗi'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
