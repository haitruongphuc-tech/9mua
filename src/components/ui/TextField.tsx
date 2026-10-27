import type { InputHTMLAttributes } from 'react';

// tone: 'light' = trang nền trắng cũ (đang chuyển dần), 'dark' = trang V4 nền đen, 'sheet' = bảng trượt nền trắng V4.
export type FieldTone = 'light' | 'dark' | 'sheet';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  tone?: FieldTone;
};

const INPUT: Record<FieldTone, string> = {
  light:
    'h-12 rounded-xl border-2 border-black/15 bg-white px-4 text-base outline-none focus:border-brand-ink aria-[invalid]:border-danger',
  dark: 'h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-brand aria-[invalid]:border-danger',
  sheet:
    'h-11 rounded-full border border-black/10 bg-white px-4 text-[14px] text-zinc-900 outline-none focus:border-brand aria-[invalid]:border-danger',
};
const LABEL: Record<FieldTone, string> = {
  light: 'text-sm font-bold',
  dark: 'text-[12px] font-bold text-white/70',
  sheet: 'text-[12px] font-bold text-zinc-600',
};
const NOTE: Record<FieldTone, string> = {
  light: 'text-sm text-black/60',
  dark: 'text-[12px] text-white/50',
  sheet: 'text-[12px] text-zinc-500',
};

export function TextField({ label, name, error, hint, id, tone = 'light', ...input }: Props) {
  const inputId = id ?? name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={LABEL[tone]}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={INPUT[tone]}
        {...input}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className={NOTE[tone]}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
