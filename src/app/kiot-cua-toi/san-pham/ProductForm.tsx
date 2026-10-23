'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { TextField } from '@/components/ui/TextField';
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

export function ProductForm({ action, initial, submitLabel, maxImages }: Props) {
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
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
        >
          {state.message}
        </p>
      ) : null}
      <ImagePicker initial={initial?.images ?? []} max={maxImages} error={f.images} />
      <TextField label="Tên sản phẩm" name="name" id="p-name" required defaultValue={v.name} error={f.name} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Giá bán (đ)"
          name="price"
          id="p-price"
          inputMode="numeric"
          required
          defaultValue={v.price}
          error={f.price}
        />
        <TextField
          label="Giá gốc (tuỳ chọn)"
          name="compareAtPrice"
          id="p-compare"
          inputMode="numeric"
          defaultValue={v.compareAtPrice}
          error={f.compareAtPrice}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Tồn kho"
          name="stock"
          id="p-stock"
          inputMode="numeric"
          required
          defaultValue={v.stock}
          error={f.stock}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p-category" className="text-sm font-bold">
            Danh mục
          </label>
          <select
            id="p-category"
            name="category"
            // <select> chỉ nhận defaultValue khi được tạo: đổi key để giữ lựa chọn sau khi form báo lỗi.
            key={v.category}
            defaultValue={v.category}
            required
            className="h-12 rounded-xl border-2 border-black/15 bg-white px-3 text-base outline-none focus:border-brand-ink"
          >
            <option value="" disabled>
              Chọn…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          {f.category ? <p className="text-sm text-danger">{f.category}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="p-description" className="text-sm font-bold">
          Mô tả
        </label>
        <textarea
          id="p-description"
          name="description"
          rows={5}
          maxLength={5000}
          defaultValue={v.description}
          className="rounded-xl border-2 border-black/15 px-4 py-3 text-base outline-none focus:border-brand-ink"
        />
        {f.description ? <p className="text-sm text-danger">{f.description}</p> : null}
      </div>
      <label className="flex items-center gap-3 font-bold">
        <input type="checkbox" name="visible" defaultChecked={v.visible} className="h-5 w-5 accent-brand" />
        Hiện sản phẩm trên Kiot
      </label>
      <SubmitButton pendingText="Đang lưu…">{submitLabel}</SubmitButton>
    </form>
  );
}
