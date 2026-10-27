'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { useT } from '@/i18n/client';
import { reportProductAction, type ReportState } from './report-action';

const REASONS = ['hang_gia', 'cam_ban', 'lua_dao', 'khac'] as const;

// Nút "Báo cáo" trên trang sản phẩm (SPEC-marketplace.md mục 6).
export function ReportProduct({ productId, loginUrl }: { productId: string; loginUrl: string | null }) {
  const t = useT();
  const [state, action] = useActionState<ReportState, FormData>(
    reportProductAction.bind(null, productId),
    {},
  );
  return (
    <details className="text-[13px]">
      <summary className="cursor-pointer font-bold text-white/50">{t('market.report.open')}</summary>
      {loginUrl ? (
        <p className="mt-2">
          <a href={loginUrl} className="font-bold text-brand underline">
            {t('market.report.login')}
          </a>{' '}
          {t('market.report.loginText')}
        </p>
      ) : state.ok ? (
        <p
          role="status"
          data-testid="report-ok"
          className="mt-2 rounded-[14px] bg-success/20 px-4 py-3 font-bold text-green-300"
        >
          {state.ok}
        </p>
      ) : (
        <form
          action={action}
          className="mt-2 flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-3"
        >
          {state.error ? (
            <p role="alert" className="font-bold text-red-400">
              {state.error}
            </p>
          ) : null}
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-bold">{t('market.report.reason')}</legend>
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input type="radio" name="reason" value={r} required className="accent-brand" />{' '}
                {t(`market.report.r.${r}`)}
              </label>
            ))}
          </fieldset>
          <textarea
            name="message"
            maxLength={1000}
            rows={3}
            placeholder={t('market.report.message')}
            className="rounded-[14px] border border-white/15 bg-white/10 p-3 text-white outline-none placeholder:text-white/40 focus:border-brand"
          />
          <SubmitButton pendingText={t('market.report.sending')}>{t('market.report.send')}</SubmitButton>
        </form>
      )}
    </details>
  );
}
