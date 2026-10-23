'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { reportProductAction, type ReportState } from './report-action';

const REASONS = [
  { value: 'hang_gia', label: 'Hàng giả, hàng nhái' },
  { value: 'cam_ban', label: 'Hàng cấm bán' },
  { value: 'lua_dao', label: 'Lừa đảo' },
  { value: 'khac', label: 'Khác' },
];

// Nút "Báo cáo" trên trang sản phẩm (SPEC-marketplace.md mục 6).
export function ReportProduct({ productId, loginUrl }: { productId: string; loginUrl: string | null }) {
  const [state, action] = useActionState<ReportState, FormData>(
    reportProductAction.bind(null, productId),
    {},
  );
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold text-black/60">Báo cáo vi phạm</summary>
      {loginUrl ? (
        <p className="mt-2">
          <a href={loginUrl} className="font-bold underline">
            Đăng nhập
          </a>{' '}
          để báo cáo sản phẩm này.
        </p>
      ) : state.ok ? (
        <p
          role="status"
          data-testid="report-ok"
          className="mt-2 rounded-xl bg-success/10 px-4 py-3 font-bold text-success"
        >
          {state.ok}
        </p>
      ) : (
        <form action={action} className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-black/10 p-3">
          {state.error ? (
            <p role="alert" className="font-bold text-danger">
              {state.error}
            </p>
          ) : null}
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-bold">Lý do</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2">
                <input type="radio" name="reason" value={r.value} required /> {r.label}
              </label>
            ))}
          </fieldset>
          <textarea
            name="message"
            maxLength={1000}
            rows={3}
            placeholder="Mô tả thêm (không bắt buộc)"
            className="rounded-xl border-2 border-black/15 p-3 outline-none focus:border-brand-ink"
          />
          <SubmitButton pendingText="Đang gửi…">Gửi báo cáo</SubmitButton>
        </form>
      )}
    </details>
  );
}
