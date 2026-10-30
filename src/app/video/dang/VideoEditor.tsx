'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useT } from '@/i18n/client';
import {
  MAX_STICKERS,
  MAX_TEXT_CHARS,
  MAX_TEXTS,
  STICKERS,
  TEXT_COLORS,
  type EditSpec,
} from '@/lib/edit-spec';

// Chỉnh video trước khi đăng (SPEC-creator.md V5.6 mục 1): cắt đầu/cuối, chữ (≤ 5 dòng, ≤ 60 ký tự, 6 màu, kéo để đặt),
// nhãn dán của 9MUA. Xem trước trên trình duyệt; máy chủ dựng một lần khi xử lý (editSpec).
type Kind = 'texts' | 'stickers';
type OverlayKind = Kind | 'card'; // card: thẻ bình luận khi trả lời bằng video
export type ReplyCard = { text: string; authorName: string; x: number; y: number };

export const emptyEdit = (): EditSpec => ({ trimStart: 0, trimEnd: null, texts: [], stickers: [] });

const stickerOf = (id: string) => STICKERS.find((x) => x.id === id)!;

// Lớp chữ / nhãn dán nằm trên khung xem trước; kéo để đổi vị trí (toạ độ 0–1 theo khung). Cỡ chữ theo chiều cao khung
// giống máy chủ (chữ h/24, nhãn dán h/28).
export function EditOverlay({
  spec,
  time,
  onMove,
  card,
  children,
}: {
  spec: EditSpec;
  time: number;
  onMove: (kind: OverlayKind, index: number, x: number, y: number) => void;
  card?: ReplyCard | null; // trả lời bình luận bằng video (SPEC-creator.md V5.8)
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(256);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight || 256));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const drag = (kind: OverlayKind, index: number) => (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    const el = box.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      onMove(
        kind,
        index,
        Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
        Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const shown = (from: number, to: number) => time >= from && time <= to;
  const item =
    'absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none whitespace-nowrap font-black';
  return (
    <div ref={box} className="relative mx-auto w-fit max-w-full">
      {children}
      {spec.texts.map((t, i) =>
        shown(t.fromSec, t.toSec) ? (
          <span
            key={`t${i}`}
            onPointerDown={drag('texts', i)}
            className={`${item} [text-shadow:0_0_3px_rgb(0_0_0/0.8)]`}
            style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, color: t.color, fontSize: height / 24 }}
            data-testid="overlay-text"
          >
            {t.text}
          </span>
        ) : null,
      )}
      {card ? (
        <span
          onPointerDown={drag('card', 0)}
          className="absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 cursor-move touch-none rounded-[10px] bg-white px-2 py-1 text-[11px] text-black shadow"
          style={{ left: `${card.x * 100}%`, top: `${card.y * 100}%` }}
          data-testid="overlay-reply-card"
        >
          <b className="block truncate">{card.authorName}</b>
          <span className="line-clamp-2">{card.text}</span>
        </span>
      ) : null}
      {spec.stickers.map((s, i) =>
        shown(s.fromSec, s.toSec) ? (
          <span
            key={`s${i}`}
            onPointerDown={drag('stickers', i)}
            className={`${item} rounded-[4px] px-[0.4em] py-[0.2em] text-white`}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              background: stickerOf(s.id).bg,
              fontSize: height / 28,
            }}
            data-testid="overlay-sticker"
          >
            {stickerOf(s.id).label}
          </span>
        ) : null,
      )}
    </div>
  );
}

// Bảng chỉnh: cắt, thêm chữ, thêm nhãn dán, giây hiện / giây ẩn từng mục.
export function EditPanel({
  spec,
  duration,
  onChange,
}: {
  spec: EditSpec;
  duration: number | null; // null: chưa đo được thời lượng — chưa cắt được
  onChange: (spec: EditSpec) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(TEXT_COLORS[0]);
  const end = Math.round((duration ?? 60) * 10) / 10;
  const addText = () => {
    const text = draft.trim();
    if (!text || spec.texts.length >= MAX_TEXTS) return;
    onChange({ ...spec, texts: [...spec.texts, { text, color, x: 0.5, y: 0.3, fromSec: 0, toSec: end }] });
    setDraft('');
  };
  const patch = (kind: Kind, index: number, change: Partial<{ fromSec: number; toSec: number }>) =>
    onChange({ ...spec, [kind]: spec[kind].map((x, i) => (i === index ? { ...x, ...change } : x)) });
  const remove = (kind: Kind, index: number) =>
    onChange({ ...spec, [kind]: spec[kind].filter((_, i) => i !== index) });
  const field = 'h-9 rounded-[10px] border border-white/15 bg-white/10 px-2 text-[13px] text-white';
  const rows: { kind: Kind; index: number; label: string; fromSec: number; toSec: number }[] = [
    ...spec.texts.map((x, index) => ({ kind: 'texts' as const, index, label: x.text, ...x })),
    ...spec.stickers.map((x, index) => ({
      kind: 'stickers' as const,
      index,
      label: stickerOf(x.id).label,
      fromSec: x.fromSec,
      toSec: x.toSec,
    })),
  ];
  return (
    <fieldset
      className="flex flex-col gap-3 rounded-[16px] border border-white/10 bg-white/5 p-3"
      data-testid="video-editor"
    >
      <legend className="px-1 text-[12px] font-bold text-white/70">✂️ {t('post.edit.title')}</legend>
      {duration ? (
        <div className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0">
              {t('post.edit.trimStart', { sec: spec.trimStart.toFixed(1) })}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, Math.floor(((spec.trimEnd ?? duration) - 1) * 10) / 10)}
              step={0.1}
              value={spec.trimStart}
              onChange={(e) => onChange({ ...spec, trimStart: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-[#ff6b00]"
              data-testid="trim-start"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-28 shrink-0">
              {t('post.edit.trimEnd', { sec: (spec.trimEnd ?? duration).toFixed(1) })}
            </span>
            <input
              type="range"
              min={Math.min(duration, Math.ceil((spec.trimStart + 1) * 10) / 10)}
              max={duration}
              step={0.1}
              value={spec.trimEnd ?? duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange({ ...spec, trimEnd: v >= duration - 0.05 ? null : v });
              }}
              className="min-w-0 flex-1 accent-[#ff6b00]"
              data-testid="trim-end"
            />
          </label>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addText();
              }
            }}
            maxLength={MAX_TEXT_CHARS}
            placeholder={t('post.edit.textHint')}
            className={`${field} min-w-0 flex-1`}
            data-testid="edit-text-input"
          />
          <button
            type="button"
            onClick={addText}
            disabled={!draft.trim() || spec.texts.length >= MAX_TEXTS}
            className="h-9 shrink-0 rounded-full bg-brand px-3 text-[12px] font-black text-white disabled:opacity-40"
            data-testid="edit-text-add"
          >
            ＋ {t('post.edit.addText')}
          </button>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label={t('post.edit.color')}>
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-brand ring-2 ring-brand/40' : 'border-white/30'}`}
              style={{ background: c }}
              data-testid={`edit-color-${c.slice(1)}`}
            />
          ))}
        </div>
      </div>
      <details>
        <summary className="cursor-pointer text-[12px] font-bold text-white/70" data-testid="edit-stickers">
          {t('post.edit.stickers')}
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={spec.stickers.length >= MAX_STICKERS}
              onClick={() =>
                onChange({
                  ...spec,
                  stickers: [...spec.stickers, { id: s.id, x: 0.5, y: 0.75, fromSec: 0, toSec: end }],
                })
              }
              className="rounded-[6px] px-2 py-1 text-[11px] font-black text-white disabled:opacity-40"
              style={{ background: s.bg }}
              data-testid={`sticker-${s.id}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </details>
      {rows.length ? (
        <ul className="flex flex-col gap-2 text-[12px]" data-testid="edit-items">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.index}`} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-bold">{row.label}</span>
              <input
                type="number"
                min={0}
                max={end}
                step={0.5}
                value={row.fromSec}
                onChange={(e) => patch(row.kind, row.index, { fromSec: Number(e.target.value) })}
                aria-label={t('post.edit.from')}
                className={`${field} w-16`}
              />
              <input
                type="number"
                min={0}
                max={end}
                step={0.5}
                value={row.toSec}
                onChange={(e) => patch(row.kind, row.index, { toSec: Number(e.target.value) })}
                aria-label={t('post.edit.to')}
                className={`${field} w-16`}
              />
              <button
                type="button"
                onClick={() => remove(row.kind, row.index)}
                aria-label={t('post.edit.remove')}
                className="h-9 w-9 shrink-0 rounded-full font-black"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11px] text-white/50">{t('post.edit.dragHint')}</p>
    </fieldset>
  );
}
