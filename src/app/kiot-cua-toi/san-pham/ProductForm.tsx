'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
import { useT } from '@/i18n/client';
import { CATEGORIES } from '@/modules/kiot/categories';
import type { ProductFormState } from './actions';
import { ImagePicker, type PickedImage } from './ImagePicker';

export type ProductFormValues = {
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  category: string;
  visible: boolean;
  images: PickedImage[];
};

type Props = {
  action: (prev: ProductFormState, form: FormData) => Promise<ProductFormState>;
  initial?: ProductFormValues;
  submitLabel: string;
  maxImages: number;
};

const select =
  'h-11 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] text-white outline-none focus:border-brand';

export function ProductForm({ action, initial, submitLabel, maxImages }: Props) {
  const t = useT();
  const [state, formAction] = useActionState<ProductFormState, FormData>(action, {});
  const f = state.fields ?? {};
  // Sau khi báo lỗi, giữ nguyên những gì người dùng vừa nhập (React tự đặt lại form về defaultValue).
  const v = state.values ?? {
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    price: initial?.price != null ? String(initial.price) : '',
    compareAtPrice: initial?.compareAtPrice != null ? String(initial.compareAtPrice) : '',
    stock: String(initial?.stock ?? 1),
    category: initial?.category ?? '',
    visible: initial?.visible ?? true,
  };
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
      <ImagePicker initial={initial?.images ?? []} max={maxImages} error={f.images} />
      <TextField
        label={t('seller.pform.name')}
        name="name"
        id="p-name"
        required
        defaultValue={v.name}
        error={f.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('seller.pform.price')}
          name="price"
          id="p-price"
          inputMode="numeric"
          required
          defaultValue={v.price}
          error={f.price}
        />
        <TextField
          label={t('seller.pform.compare')}
          name="compareAtPrice"
          id="p-compare"
          inputMode="numeric"
          defaultValue={v.compareAtPrice}
          error={f.compareAtPrice}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('seller.pform.stock')}
          name="stock"
          id="p-stock"
          inputMode="numeric"
          required
          defaultValue={v.stock}
          error={f.stock}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-category" className="text-[12px] font-bold text-white/70">
            {t('seller.pform.category')}
          </label>
          <select
            id="p-category"
            name="category"
            // <select> chỉ nhận defaultValue khi được tạo: đổi key để giữ lựa chọn sau khi form báo lỗi.
            key={v.category}
            defaultValue={v.category}
            required
            className={select}
          >
            <option value="" disabled>
              {t('seller.pform.choose')}
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icon} {t(`market.cat.${c.slug}`)}
              </option>
            ))}
          </select>
          {f.category ? <p className="text-[12px] text-red-400">{f.category}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="p-description" className="text-[12px] font-bold text-white/70">
          {t('seller.pform.description')}
        </label>
        <textarea
          id="p-description"
          name="description"
          rows={5}
          maxLength={5000}
          defaultValue={v.description}
          className="rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-[14px] text-white outline-none focus:border-brand"
        />
        {f.description ? <p className="text-[12px] text-red-400">{f.description}</p> : null}
      </div>
      <label className="flex items-center gap-3 text-[14px] font-bold">
        <input type="checkbox" name="visible" defaultChecked={v.visible} className="h-5 w-5 accent-brand" />
        {t('seller.pform.visible')}
      </label>
      <SubmitButton pendingText={t('seller.form.saving')}>{submitLabel}</SubmitButton>
    </form>
  );
}
