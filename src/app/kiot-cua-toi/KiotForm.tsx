'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
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
              ? { state: 'ok', message: `${slug}.${rootDomain} còn trống` }
              : { state: 'error', message: d.message },
          ),
        )
        .catch(() => {});
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug, slugLocked, initial?.slug, rootDomain]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? (
        <p
          role="alert"
          data-testid="form-error"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.message}
        </p>
      ) : null}
      {state.ok ? (
        <p
          role="status"
          data-testid="form-ok"
          className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success"
        >
          {state.ok}
        </p>
      ) : null}
      <TextField
        label="Tên Kiot"
        name="name"
        id="kiot-name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={state.fields?.name}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kiot-slug" className="text-sm font-bold">
          Địa chỉ Kiot
        </label>
        <div className="flex h-12 items-center rounded-xl border-2 border-black/15 bg-white pr-3 focus-within:border-brand-ink">
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
            className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-4 text-base outline-none read-only:text-black/60"
          />
          <span className="shrink-0 text-black/60">.{rootDomain}</span>
        </div>
        <p
          id="kiot-slug-hint"
          data-testid="slug-hint"
          className={`text-sm ${state.fields?.slug || hint.state === 'error' ? 'text-danger' : hint.state === 'ok' ? 'text-success' : 'text-black/60'}`}
        >
          {state.fields?.slug ??
            (slugLocked
              ? 'Địa chỉ đã cố định sau khi kích hoạt.'
              : hint.state === 'checking'
                ? 'Đang kiểm tra…'
                : (hint.message ?? 'Chỉ đổi được trước khi kích hoạt Kiot.'))}
        </p>
      </div>
      <TextField
        label="Số điện thoại / Zalo liên hệ"
        name="contactPhone"
        id="kiot-phone"
        inputMode="tel"
        required
        defaultValue={values?.contactPhone}
        error={state.fields?.contactPhone}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kiot-description" className="text-sm font-bold">
          Giới thiệu ngắn
        </label>
        <textarea
          id="kiot-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values?.description}
          className="rounded-xl border-2 border-black/15 px-4 py-3 text-base outline-none focus:border-brand-ink"
        />
        {state.fields?.description ? <p className="text-sm text-danger">{state.fields.description}</p> : null}
      </div>
      <SubmitButton pendingText="Đang lưu…">{submitLabel}</SubmitButton>
    </form>
  );
}
