'use client';

import { useActionState, useState } from 'react';
import { socialLook, SOCIAL_ORDER } from '@/components/profile/SocialLinks';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { useT } from '@/i18n/client';
import { saveSocialLinksAction, type ConnectState } from './actions';

const EXAMPLE: Record<string, string> = {
  tiktok: 'tiktok.com/@ten-cua-ban',
  facebook: 'facebook.com/ten-trang',
  instagram: 'instagram.com/ten-cua-ban',
  youtube: 'youtube.com/@ten-kenh',
  shopee: 'shopee.vn/ten-shop',
  zalo: 'zalo.me/0912345678',
};

export function ConnectForm({ links }: { links: Partial<Record<string, string>> }) {
  const t = useT();
  const [state, action] = useActionState<ConnectState, FormData>(saveSocialLinksAction, {});
  // Ô nhập có kiểm soát: lưu bị báo sai thì vẫn giữ chữ vừa gõ (React tự xoá form không kiểm soát sau khi gửi).
  const [values, setValues] = useState<Partial<Record<string, string>>>(links);
  return (
    <form action={action} className="mt-4 flex flex-col gap-2">
      {SOCIAL_ORDER.map((p) => {
        const look = socialLook(p);
        const bad = state.invalid?.includes(p);
        return (
          <label
            key={p}
            className={`flex items-center gap-3 rounded-[16px] border bg-white/5 p-3 ${bad ? 'border-danger' : 'border-white/10'}`}
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-black text-white ${look.cls}`}
              aria-hidden
            >
              {look.mark}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[14px] font-bold">{look.name}</span>
              <input
                name={p}
                value={values[p] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
                placeholder={EXAMPLE[p]}
                inputMode="url"
                autoComplete="off"
                maxLength={300}
                aria-invalid={bad || undefined}
                aria-label={t('profile.connect.linkOf', { name: look.name })}
                className="h-10 w-full rounded-full border border-white/15 bg-black/30 px-4 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-brand"
              />
              {bad ? (
                <span className="text-[11px] font-bold text-danger">
                  {t('profile.connect.wrongSite', { name: look.name })}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
      {state.message ? (
        <p
          role="status"
          className={`text-[13px] font-bold ${state.ok ? 'text-success' : 'text-danger'}`}
          data-testid="connect-status"
        >
          {state.message}
        </p>
      ) : null}
      <SubmitButton tone="v4" pendingText={t('profile.connect.saving')}>
        {t('profile.connect.save')}
      </SubmitButton>
    </form>
  );
}
