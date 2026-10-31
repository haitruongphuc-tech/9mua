'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { saveVariantsAction } from './variant-actions';

type Row = {
  id?: string;
  option1: string;
  option2: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  hidden: boolean;
};

// Biến thể sản phẩm (SPEC-kiot.md V5.6): tối đa 2 nhóm tuỳ chọn, tối đa 50 biến thể; mỗi dòng có giá, giá gốc, tồn
// kho, ẩn/hiện. Lưu cả bộ một lần.
export function VariantEditor({
  productId,
  optionNames,
  initial,
  max,
}: {
  productId: string;
  optionNames: string[];
  initial: Row[];
  max: number;
}) {
  const t = useT();
  const [names, setNames] = useState([optionNames[0] ?? '', optionNames[1] ?? '']);
  const [rows, setRows] = useState<Row[]>(initial);
  const two = Boolean(names[1]?.trim());
  const cell = 'h-9 min-w-0 rounded-[8px] border border-white/15 bg-white/5 px-2 text-[13px]';
  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const payload = JSON.stringify({
    optionNames: names.filter((n) => n.trim()),
    variants: rows.map((r) => ({
      id: r.id,
      option1: r.option1,
      option2: two ? r.option2 : null,
      price: Number(r.price.replace(/\D/g, '')),
      compareAtPrice: r.compareAtPrice ? Number(r.compareAtPrice.replace(/\D/g, '')) : null,
      stock: Number(r.stock.replace(/\D/g, '')),
      hidden: r.hidden,
    })),
  });
  return (
    <form
      action={saveVariantsAction.bind(null, productId)}
      className="flex flex-col gap-3"
      data-testid="variant-editor"
    >
      <input type="hidden" name="payload" value={payload} />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((k) => (
          <input
            key={k}
            value={names[k]}
            onChange={(e) => setNames((n) => n.map((x, j) => (j === k ? e.target.value : x)))}
            maxLength={30}
            placeholder={t(k ? 'seller.variant.option2' : 'seller.variant.option1')}
            className={cell}
            data-testid={`variant-name-${k}`}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li
            key={r.id ?? `new-${i}`}
            className="grid grid-cols-2 gap-1.5 rounded-[12px] bg-white/5 p-2 sm:grid-cols-6"
            data-testid="variant-row"
          >
            <input
              value={r.option1}
              onChange={(e) => set(i, { option1: e.target.value })}
              placeholder={names[0] || t('seller.variant.option1')}
              className={cell}
            />
            {two ? (
              <input
                value={r.option2}
                onChange={(e) => set(i, { option2: e.target.value })}
                placeholder={names[1]}
                className={cell}
              />
            ) : null}
            <input
              value={r.price}
              onChange={(e) => set(i, { price: e.target.value })}
              inputMode="numeric"
              placeholder={t('seller.variant.price')}
              className={cell}
            />
            <input
              value={r.compareAtPrice}
              onChange={(e) => set(i, { compareAtPrice: e.target.value })}
              inputMode="numeric"
              placeholder={t('seller.variant.compareAt')}
              className={cell}
            />
            <input
              value={r.stock}
              onChange={(e) => set(i, { stock: e.target.value })}
              inputMode="numeric"
              placeholder={t('seller.variant.stock')}
              className={cell}
            />
            <label className="flex items-center gap-1 text-[12px]">
              <input
                type="checkbox"
                checked={r.hidden}
                onChange={(e) => set(i, { hidden: e.target.checked })}
                className="accent-[#ff6b00]"
              />
              {t('seller.variant.hidden')}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {rows.length < max ? (
          <button
            type="button"
            onClick={() =>
              setRows((r) => [
                ...r,
                { option1: '', option2: '', price: '', compareAtPrice: '', stock: '0', hidden: false },
              ])
            }
            className="h-9 rounded-full bg-white/10 px-4 text-[12px] font-black"
            data-testid="variant-add"
          >
            ＋ {t('seller.variant.add')}
          </button>
        ) : null}
        <button
          type="submit"
          className="h-9 rounded-full bg-brand px-4 text-[12px] font-black"
          data-testid="variant-save"
        >
          {t('seller.variant.save')}
        </button>
      </div>
    </form>
  );
}
