'use client';

import { ArrowDown, ArrowUp, GripVertical, Monitor, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import { useT } from '@/i18n/client';
import type { KiotBlock, KiotLayout, KiotPalette, KiotTemplate } from '@/modules/kiot';
import { saveLayoutAction } from './actions';

// Trình chỉnh giao diện Kiot (SPEC-kiot.md V5.3): chọn 1 trong 10 bố cục và 5 bảng màu; bật/tắt, kéo đổi thứ tự khối
// (chuột, hoặc chạm giữ trên điện thoại; mỗi khối cũng có nút lên/xuống); xem trước khung điện thoại / máy tính; "Lưu" mới
// áp dụng.
export function KiotBuilder({
  initial,
  products,
  templates,
  palettes,
  maxFeatured,
}: {
  initial: KiotLayout;
  products: { id: string; name: string }[];
  templates: readonly KiotTemplate[];
  palettes: readonly KiotPalette[];
  maxFeatured: number;
}) {
  const KIOT_TEMPLATES = templates;
  const KIOT_PALETTES = palettes;
  const MAX_FEATURED = maxFeatured;
  const t = useT();
  const [layout, setLayout] = useState(initial);
  const [view, setView] = useState<'phone' | 'desktop'>('phone');
  const [dragging, setDragging] = useState<number | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const palette = KIOT_PALETTES.find((p) => p.id === layout.palette) ?? KIOT_PALETTES[0]!;
  const template = KIOT_TEMPLATES.find((x) => x.id === layout.template) ?? KIOT_TEMPLATES[0]!;

  const move = (from: number, to: number) =>
    setLayout((l) => {
      if (to < 0 || to >= l.blocks.length || from === to) return l;
      const blocks = [...l.blocks];
      const [b] = blocks.splice(from, 1);
      blocks.splice(to, 0, b!);
      return { ...l, blocks };
    });

  // Kéo bằng con trỏ (chuột hoặc ngón tay): chạm giữ 250ms rồi kéo; vị trí mới theo khối đang nằm dưới con trỏ.
  function pointerDown(i: number, e: React.PointerEvent) {
    const start = () => {
      setDragging(i);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    if (e.pointerType === 'mouse') start();
    else hold.current = setTimeout(start, 250);
  }
  function pointerMove(e: React.PointerEvent) {
    if (dragging === null || !list.current) return;
    const items = [...list.current.querySelectorAll<HTMLLIElement>('[data-block]')];
    const over = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (over >= 0 && over !== dragging) {
      move(dragging, over);
      setDragging(over);
    }
  }
  function pointerUp() {
    if (hold.current) clearTimeout(hold.current);
    setDragging(null);
  }

  const toggleFeatured = (id: string) =>
    setLayout((l) =>
      l.featured.includes(id)
        ? { ...l, featured: l.featured.filter((x) => x !== id) }
        : l.featured.length >= MAX_FEATURED
          ? l
          : { ...l, featured: [...l.featured, id] },
    );

  const blockName = (id: KiotBlock) => t(`seller.builder.block.${id}`);
  const chip = (on: boolean) =>
    `h-9 rounded-full px-3 text-[12px] font-bold ${on ? 'bg-white text-ink' : 'bg-white/10'}`;

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-white/70">{t('seller.builder.templates')}</h2>
          <div className="grid grid-cols-5 gap-2" data-testid="builder-templates">
            {KIOT_TEMPLATES.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setLayout((l) => ({ ...l, template: x.id }))}
                aria-pressed={layout.template === x.id}
                className={chip(layout.template === x.id)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-2" data-testid="builder-palettes">
            {KIOT_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLayout((l) => ({ ...l, palette: p.id }))}
                aria-pressed={layout.palette === p.id}
                aria-label={p.id}
                className={`h-9 w-9 rounded-full border-2 ${layout.palette === p.id ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: p.accent }}
                data-testid={`builder-palette-${p.id}`}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-white/70">{t('seller.builder.blocks')}</h2>
          <ul
            ref={list}
            className="flex touch-none flex-col gap-1.5 select-none"
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            data-testid="builder-blocks"
          >
            {layout.blocks.map((b, i) => (
              <li
                key={b.id}
                data-block={b.id}
                className={`flex items-center gap-2 rounded-[12px] px-2 py-2 ${dragging === i ? 'bg-white/20' : 'bg-white/5'}`}
              >
                <span
                  onPointerDown={(e) => pointerDown(i, e)}
                  className="cursor-grab p-1 text-white/50"
                  aria-hidden
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <label className="flex flex-1 items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={b.on}
                    onChange={() =>
                      setLayout((l) => ({
                        ...l,
                        blocks: l.blocks.map((x) => (x.id === b.id ? { ...x, on: !x.on } : x)),
                      }))
                    }
                    className="h-4 w-4 accent-[#ff6b00]"
                    data-testid={`builder-on-${b.id}`}
                  />
                  {blockName(b.id)}
                </label>
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  aria-label={t('seller.builder.up')}
                  className="p-1"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  aria-label={t('seller.builder.down')}
                  className="p-1"
                  data-testid={`builder-down-${b.id}`}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {products.length ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold text-white/70">
              {t('seller.builder.featured', { count: layout.featured.length, max: MAX_FEATURED })}
            </h2>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleFeatured(p.id)}
                  aria-pressed={layout.featured.includes(p.id)}
                  className={chip(layout.featured.includes(p.id))}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <form action={saveLayoutAction}>
          <input type="hidden" name="layout" value={JSON.stringify(layout)} />
          <button
            type="submit"
            className="h-11 w-full rounded-full bg-brand text-[14px] font-black"
            data-testid="builder-save"
          >
            {t('seller.builder.save')}
          </button>
        </form>
      </div>

      <div className="flex flex-col items-center gap-2 lg:w-[420px]">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('phone')}
            className={chip(view === 'phone')}
            aria-label={t('seller.builder.phone')}
          >
            <Smartphone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('desktop')}
            className={chip(view === 'desktop')}
            aria-label={t('seller.builder.desktop')}
          >
            <Monitor className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`overflow-hidden rounded-[22px] border-4 border-white/20 ${view === 'phone' ? 'w-[240px]' : 'w-full'}`}
          style={{ backgroundColor: palette.surface }}
          data-testid="builder-preview"
        >
          {layout.blocks
            .filter((b) => b.on)
            .map((b) => (
              <div
                key={b.id}
                className={`border-b border-white/10 px-3 py-2 text-[11px] ${template.align === 'center' ? 'text-center' : ''}`}
                style={
                  b.id === 'cover'
                    ? {
                        aspectRatio: template.cover,
                        backgroundColor: palette.accent,
                        color: palette.onAccent,
                      }
                    : undefined
                }
              >
                {b.id === 'featured' ? (
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${view === 'phone' ? 2 : template.featuredCols}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: Math.max(1, Math.min(layout.featured.length || 2, 8)) }, (_, k) => (
                      <span
                        key={k}
                        className="h-8 rounded"
                        style={{ backgroundColor: `${palette.accent}55` }}
                      />
                    ))}
                  </div>
                ) : (
                  blockName(b.id)
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
