import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';
import { createVideoUpload, saveUpload } from '@/modules/creator';
import { createProduct, uploadProductImage, type ProductInput } from '@/modules/kiot';
import { isStudioOwner } from './studio';

// Đăng bán từ AI Studio (SPEC-ai.md mục 7). Chỉ chạy khi chủ Kiot bấm "Đăng bán" — AI không bao giờ tự đăng.
export type StudioDraft = {
  name: string;
  price: unknown;
  stock: unknown;
  category: string;
  description: string;
  imageIds: string[]; // ảnh AI đã chọn, ảnh đầu là ảnh chính
  caption?: string;
  slideshowId?: string | null;
};

export type PublishResult =
  | { ok: true; productId: string; videoId?: string; videoError?: string }
  | { ok: false; error: 'NOT_OWNER' | 'PRODUCT_LIMIT' | 'COMMITMENT_REQUIRED' }
  | { ok: false; error: 'INVALID_INPUT'; fields: Partial<Record<string, string>> };

const BAD_IMAGES = 'Ảnh không hợp lệ, hãy tải lại ảnh';

export async function publishFromStudio(userId: string, draft: StudioDraft): Promise<PublishResult> {
  if (!(await isStudioOwner(userId))) return { ok: false, error: 'NOT_OWNER' };
  const ids = draft.imageIds;
  const rows = await db.aiImage.findMany({ where: { id: { in: ids }, userId } });
  if (ids.length === 0 || rows.length !== new Set(ids).size || rows.length !== ids.length)
    return { ok: false, error: 'INVALID_INPUT', fields: { images: BAD_IMAGES } };

  // Chép ảnh AI sang ảnh sản phẩm (qua đúng bước tải ảnh của Kiot), để ảnh AI dọn sau 7 ngày không ảnh hưởng.
  const productImageIds: string[] = [];
  for (const id of ids) {
    const file = imageStore().localPath(rows.find((r) => r.id === id)!.url);
    const data = file ? await readFile(file).catch(() => null) : null;
    const uploaded = data ? await uploadProductImage(userId, data) : null;
    if (!uploaded?.ok) return { ok: false, error: 'INVALID_INPUT', fields: { images: BAD_IMAGES } };
    productImageIds.push(uploaded.image.id);
  }

  const input: ProductInput = {
    name: draft.name,
    description: draft.description,
    price: draft.price,
    stock: draft.stock,
    category: draft.category,
    visible: true,
    imageIds: productImageIds,
  };
  const product = await createProduct(userId, input);
  if (!product.ok) {
    if (product.error === 'INVALID_INPUT') return product;
    return { ok: false, error: product.error === 'NO_KIOT' ? 'NOT_OWNER' : product.error };
  }

  if (!draft.slideshowId) return { ok: true, productId: product.productId };
  const video = await postSlideshow(userId, draft.slideshowId, draft.caption ?? '', product.productId);
  return video.ok
    ? { ok: true, productId: product.productId, videoId: video.videoId }
    : { ok: true, productId: product.productId, videoError: video.error };
}

// Đưa video đã ghép vào luồng đăng video thường của creator (kiểm tra, chuyển mã, ảnh bìa, giới hạn 10 video/ngày).
async function postSlideshow(
  userId: string,
  slideshowId: string,
  caption: string,
  productId: string,
): Promise<{ ok: true; videoId: string } | { ok: false; error: string }> {
  const job = await db.aiSlideshow.findFirst({ where: { id: slideshowId, userId } });
  const file = job?.status === 'done' && job.url ? imageStore().localPath(job.url) : null;
  if (!file) return { ok: false, error: 'NOT_READY' };
  const upload = await saveUpload(userId, createReadStream(file));
  if (!upload.ok) return upload;
  // Video làm từ AI Studio luôn có nhãn "Nội dung tạo bằng AI", không gỡ được (SPEC-creator.md V5.3).
  const created = await createVideoUpload(userId, upload.uploadId, {
    caption,
    productIds: [productId],
    aiStudio: true,
  });
  return created.ok ? { ok: true, videoId: created.videoId } : created;
}
