'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Suggestion = { id: string; handle: string; displayName: string; avatarUrl: string | null };

// Ô nhập có gợi ý @tên (SPEC-social.md V5.4 mục 2): gõ "@" hiện người mình follow trước, rồi tìm theo @tên / tên hiển thị.
export function MentionInput({
  value,
  onChange,
  ...rest
}: { value: string; onChange: (value: string) => void } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const token = /(^|\s)@([a-z0-9._]{0,30})$/i.exec(
    value.slice(0, ref.current?.selectionStart ?? value.length),
  );
  const query = token ? token[2]! : null;
  useEffect(() => {
    if (query === null) return setItems([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/social/mention-suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Suggestion[] }) => setItems(d.items))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const pick = (s: Suggestion) => {
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([a-z0-9._]{0,30})$/i, `@${s.handle} `);
    onChange(before + value.slice(caret));
    setItems([]);
    ref.current?.focus();
  };
  return (
    <div className="relative min-w-0 flex-1">
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {items.length ? (
        <ul
          className="absolute bottom-full left-0 z-20 mb-1 max-h-56 w-full overflow-y-auto rounded-[12px] bg-white text-black shadow-lg"
          data-testid="mention-suggestions"
        >
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-zinc-100"
              >
                <b>@{s.handle}</b>
                <span className="truncate text-zinc-500">{s.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
