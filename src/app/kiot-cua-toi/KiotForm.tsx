'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { slugify } from '@/modules/kiot/slug';
import type { KiotFormState, KiotFormValues } from './actions';

type Props = {
  action: (prev: KiotFormState, form: FormData) => Promise<KiotFormState>;
  initial?: KiotFormValues;
  rootDomain: string;
  slugLocked?: boolean;
  submitLabel: string;
};

type SlugHint = { state: 'idle' | 'checking' | 'ok' | 'error'; message?: string };

export function KiotForm({ action, initial, rootDomain, slugLocked = false, submitLabel }: Props) {
  const t = useT();
  const [state, formAction] = useActionState<KiotFormState, FormData>(action, { values: initial });
  const values = state.values ?? initial;
  const [name, setName] = useState(values?.name ?? '');
  const [slug, setSlug] = useState(values?.slug ?? '');
  const slugTouched = useRef(Boolean(initial?.slug));
  const [hint, setHint] = useState<SlugHint>({ state: 'idle' });

  // Gợi ý địa chỉ từ tên cho tới khi người dùng tự sửa ô địa chỉ.
  useEffect(() => {
    if (!slugTouched.current) setSlug(slugify(name));
  }, [name]);

  useEffect(() => {
    if (slugLocked || !slug || slug === initial?.slug) return setHint({ state: 'idle' });
    setHint({ state: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/kiot/slug?value=${encodeURIComponent(slug)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { ok: boolean; message?: string }) =>
          setHint(
            d.ok
              ? { state: 'ok', message: t('seller.form.slugFree', { slug, domain: rootDomain }) }
              : { state: 'error', message: d.message },
          ),
        )
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug, slugLocked, initial?.slug, rootDomain, t]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px] font-bold text-red-300"
        >
          {state.message}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          data-testid="form-ok"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {state.ok}
        </p>
      ) : null}
      <TextField
        label={t('seller.form.name')}
        name="name"
        id="kiot-name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={state.fields?.name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kiot-slug" className="text-[12px] font-bold text-white/70">
          {t('seller.form.slug')}
        </label>
        <div className="flex h-11 items-center rounded-full border border-white/15 bg-white/10 pr-4 text-white focus-within:border-brand">
          <input
            id="kiot-slug"
            name="slug"
            value={slug}
            readOnly={slugLocked}
            aria-invalid={state.fields?.slug ? true : undefined}
            aria-describedby="kiot-slug-hint"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => {
              slugTouched.current = true;
              setSlug(e.target.value.toLowerCase());
            }}
            className="h-full min-w-0 flex-1 rounded-full bg-transparent px-4 text-[14px] outline-none read-only:text-white/60"
          />
          <span className="shrink-0 text-[13px] text-white/50">.{rootDomain}</span>
        </div>
        <p
          id="kiot-slug-hint"
          data-testid="slug-hint"
          className={`text-[12px] ${state.fields?.slug || hint.state === 'error' ? 'text-red-400' : hint.state === 'ok' ? 'text-green-400' : 'text-white/50'}`}
        >
          {state.fields?.slug ??
            (slugLocked
              ? t('seller.form.slugFixed')
              : hint.state === 'checking'
                ? t('seller.form.slugChecking')
                : (hint.message ?? t('seller.form.slugHint')))}
        </p>
      </div>
      <TextField
        label={t('seller.form.phone')}
        name="contactPhone"
        id="kiot-phone"
        inputMode="tel"
        required
        defaultValue={values?.contactPhone}
        error={state.fields?.contactPhone}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kiot-description" className="text-[12px] font-bold text-white/70">
          {t('seller.form.description')}
        </label>
        <textarea
          id="kiot-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values?.description}
          className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white outline-none focus:border-brand"
        />
        {state.fields?.description ? (
          <p className="text-[12px] text-red-400">{state.fields.description}</p>
        ) : null}
      </div>
      <SubmitButton pendingText={t('seller.form.saving')}>{submitLabel}</SubmitButton>
    </form>
  );
}
