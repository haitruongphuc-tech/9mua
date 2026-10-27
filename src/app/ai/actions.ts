'use server';

import { localizeFields } from '@/i18n/module-messages';
import { getT, type T } from '@/i18n/server';
import { kiotOrigin } from '@/lib/urls';
import {
  captionFor,
  drawProductImages,
  publishFromStudio,
  startSlideshow,
  writeProductCopy,
  type ProductCopy,
  type StoredImage,
} from '@/modules/ai';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, productPath } from '@/modules/kiot';

export type Fail = { ok: false; error: string; fields?: Record<string, string> };

const AI_ERRORS = [
  'NOT_OWNER',
  'DISABLED',
  'DAILY_LIMIT',
  'BUDGET',
  'AI_ERROR',
  'INVALID_INPUT',
  'PRODUCT_LIMIT',
] as const;
const VIDEO_ERRORS = [
  'NOT_FOUND',
  'TOO_LARGE',
  'DAILY_LIMIT',
  'BAD_FORMAT',
  'PRODUCT_INVALID',
  'CAPTION_TOO_LONG',
] as const;

function fail(t: T, error: string, fields?: Partial<Record<string, string>>): Fail {
  const code = AI_ERRORS.find((c) => c === error);
  const localized = localizeFields(t, fields);
  return {
    ok: false,
    error: code ? t(`ai.err.${code}`) : t('ai.err.generic'),
    ...(localized ? { fields: localized as Record<string, string> } : {}),
  };
}

type CopyInput = { name: string; category: string; note: string };

export async function writeCopyAction(
  input: CopyInput,
): Promise<{ ok: true; copy: ProductCopy; caption: string } | Fail> {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const r = await writeProductCopy(user.id, input);
  if (r.ok) return { ok: true, copy: r.copy, caption: captionFor(r.copy) };
  return fail(t, r.error, 'fields' in r ? r.fields : undefined);
}

export async function drawImagesAction(
  input: CopyInput & { style: string },
): Promise<{ ok: true; images: StoredImage[] } | Fail> {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const r = await drawProductImages(user.id, input);
  if (r.ok) return r;
  return fail(t, r.error, 'fields' in r ? r.fields : undefined);
}

export async function startSlideshowAction(imageIds: string[]): Promise<{ ok: true; jobId: string } | Fail> {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const r = await startSlideshow(user.id, imageIds);
  return r.ok ? r : fail(t, r.error);
}

export type PublishDraft = {
  name: string;
  price: string;
  stock: string;
  category: string;
  description: string;
  caption: string;
  imageIds: string[];
  slideshowId: string | null;
};

export async function publishAction(
  draft: PublishDraft,
): Promise<{ ok: true; productUrl: string; videoQueued: boolean; videoNote: string | null } | Fail> {
  const [user, t] = await Promise.all([requireUser(), getT()]);
  const digits = (v: string) => v.replace(/[^\d]/g, '');
  const r = await publishFromStudio(user.id, {
    ...draft,
    price: digits(draft.price),
    stock: digits(draft.stock),
  });
  if (!r.ok) return fail(t, r.error, 'fields' in r ? r.fields : undefined);
  const kiot = await getKiotByOwner(user.id);
  const productUrl = kiot
    ? `${kiotOrigin(kiot.slug)}${productPath({ id: r.productId, name: draft.name })}`
    : '/';
  let videoNote: string | null = null;
  if (r.videoError) {
    const code = VIDEO_ERRORS.find((c) => c === r.videoError);
    videoNote = t('ai.videoSkipped', {
      reason: code
        ? t(`post.err.${code}`)
        : r.videoError === 'NOT_READY'
          ? t('ai.err.NOT_READY')
          : t('ai.err.generic'),
    });
  }
  return { ok: true, productUrl, videoQueued: Boolean(r.videoId), videoNote };
}
