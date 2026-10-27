'use client';

import { Image as ImageIcon, Mic, Rocket, Sparkles, Video } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { LANGS } from '@/i18n/config';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/messages';
import { formatVnd } from '@/lib/format';
import type { ProductCopy, StoredImage } from '@/modules/ai';
import { drawImagesAction, publishAction, startSlideshowAction, writeCopyAction, type Fail } from './actions';

type Style = { id: string; name: string };
type Slideshow = { id: string; status: 'queued' | 'running' | 'done' | 'failed'; url: string | null };
type Published = { productUrl: string; videoQueued: boolean; videoNote: string | null; name: string };

// Màu ô mẫu của 5 phong cách, giống V4.
const STYLE_SWATCH: Record<string, string> = {
  flat: 'from-orange-300 to-amber-200',
  '3d': 'from-indigo-500 to-cyan-400',
  photo: 'from-stone-600 to-stone-300',
  sketch: 'from-zinc-200 to-zinc-50',
  neon: 'from-fuchsia-600 to-brand',
};

const field =
  'h-12 w-full rounded-full border border-white/15 bg-black/40 px-4 text-[14px] text-white outline-none focus:border-brand';
const area =
  'w-full rounded-[18px] border border-white/15 bg-black/40 px-4 py-3 text-[14px] text-white outline-none focus:border-brand';

export function AiStudio(props: {
  header: React.ReactNode;
  text: boolean;
  image: boolean;
  budgetOk: boolean;
  quota: { textLeft: number; imageLeft: number };
  categories: string[];
  styles: Style[];
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [style, setStyle] = useState('photo');
  const [quota, setQuota] = useState(props.quota);
  const [copy, setCopy] = useState<ProductCopy | null>(null);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [caption, setCaption] = useState('');
  const [stock, setStock] = useState('10');
  const [slideshow, setSlideshow] = useState<Slideshow | null>(null);
  const [withVideo, setWithVideo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [published, setPublished] = useState<Published | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [videoBusy, startVideo] = useTransition();

  useEffect(() => setCanSpeak('speechSynthesis' in window), []);

  // Worker ghép video ở nền: hỏi trạng thái mỗi 2 giây tới khi xong hoặc lỗi.
  useEffect(() => {
    if (!slideshow || slideshow.status === 'done' || slideshow.status === 'failed') return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/ai/slideshow/${slideshow.id}`, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const s = (await res.json()) as Omit<Slideshow, 'id'>;
      if (s.status !== slideshow.status) setSlideshow({ id: slideshow.id, ...s });
    }, 2000);
    return () => clearInterval(timer);
  }, [slideshow]);

  const canText = props.text && props.budgetOk && quota.textLeft > 0;
  const canImage = props.image && props.budgetOk && quota.imageLeft > 0;
  const styleName = props.styles.find((s) => s.id === style)?.name ?? '';

  const showFail = (r: Fail) => {
    setError(r.error);
    setFields(r.fields ?? {});
  };

  const generate = () => {
    setError(null);
    setFields({});
    if (name.trim().length < 2) return setFields({ name: t('ai.namePlaceholder') });
    if (!category) return setFields({ category: t('ai.category') });
    startGenerate(async () => {
      const input = { name, category, note };
      const [c, d] = await Promise.all([
        canText ? writeCopyAction(input) : null,
        canImage ? drawImagesAction({ ...input, style }) : null,
      ]);
      if (c?.ok) {
        setCopy(c.copy);
        setDescription(c.copy.description);
        setCaption(c.caption);
        setQuota((q) => ({ ...q, textLeft: q.textLeft - 1 }));
      } else if (c) showFail(c);
      if (d?.ok) {
        setImages(d.images);
        setSelected(d.images.map((i) => i.id));
        setSlideshow(null);
        setQuota((q) => ({ ...q, imageLeft: q.imageLeft - 1 }));
      } else if (d) showFail(d);
    });
  };

  const toggle = (id: string) => {
    setSlideshow(null); // video ghép theo ảnh đã chọn: đổi ảnh thì ghép lại
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const makeVideo = () =>
    startVideo(async () => {
      setError(null);
      const r = await startSlideshowAction(selected);
      if (r.ok) setSlideshow({ id: r.jobId, status: 'queued', url: null });
      else showFail(r);
    });

  const speak = (code: (typeof LANGS)[number]['code']) => {
    if (!copy) return;
    const u = new SpeechSynthesisUtterance(code === 'vi' ? copy.intro : copy.translations[code]);
    u.lang = LANGS.find((l) => l.code === code)!.tts;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const publish = () => {
    setError(null);
    setFields({});
    if (selected.length === 0) return setFields({ images: t('ai.pickOne') });
    startPublish(async () => {
      const r = await publishAction({
        name,
        price,
        stock,
        category,
        description,
        caption,
        imageIds: selected,
        slideshowId: withVideo && slideshow?.status === 'done' ? slideshow.id : null,
      });
      if (r.ok) setPublished({ ...r, name });
      else showFail(r);
    });
  };

  const reset = () => {
    setPublished(null);
    setCopy(null);
    setImages([]);
    setSelected([]);
    setDescription('');
    setCaption('');
    setSlideshow(null);
    setName('');
    setNote('');
  };

  if (published) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-5" data-testid="ai-published">
        <p className="text-[18px] font-black text-green-400">{t('ai.published', { name: published.name })}</p>
        {published.videoQueued ? (
          <p className="mt-2 text-[13px] text-white/70">{t('ai.videoQueued')}</p>
        ) : null}
        {published.videoNote ? <p className="mt-2 text-[13px] text-red-300">{published.videoNote}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={published.productUrl}
            className="h-11 rounded-full bg-brand px-5 text-[14px] font-black leading-[44px]"
          >
            {t('ai.viewProduct')}
          </a>
          <Link
            href="/kiot-cua-toi/san-pham"
            className="h-11 rounded-full border border-white/20 px-5 text-[14px] font-bold leading-[44px]"
          >
            {t('ai.myProducts')}
          </Link>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full border border-white/20 px-5 text-[14px] font-bold"
          >
            {t('ai.again')}
          </button>
        </div>
      </div>
    );
  }

  const fieldError = (key: string) =>
    fields[key] ? <span className="px-4 text-[12px] text-red-300">{fields[key]}</span> : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[24px] border border-white/10 bg-gradient-to-br from-fuchsia-700/40 via-brand/30 to-cyan-600/30 p-5">
        {props.header}
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px]">
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t('ai.name')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder={t('ai.namePlaceholder')}
              aria-label={t('ai.name')}
              className={field}
              data-testid="ai-name"
            />
            {fieldError('name')}
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t('ai.price')}</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder={t('ai.price')}
              aria-label={t('ai.price')}
              className={field}
              data-testid="ai-price"
            />
            {fieldError('price')}
          </label>
        </div>
        <label className="mt-2 flex flex-col gap-1">
          <span className="sr-only">{t('ai.category')}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label={t('ai.category')}
            className={field}
            data-testid="ai-category"
          >
            <option value="">{t('ai.category')}</option>
            {props.categories.map((c) => (
              <option key={c} value={c}>
                {t(`market.cat.${c}` as MessageKey)}
              </option>
            ))}
          </select>
          {fieldError('category')}
        </label>
        <label className="mt-2 flex flex-col gap-1">
          <span className="px-1 text-[12px] font-bold">{t('ai.note')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={t('ai.notePlaceholder')}
            className={area}
            data-testid="ai-note"
          />
          <span className="px-1 text-[11px] text-white/60">{t('ai.noteHint')}</span>
          {fieldError('note')}
        </label>

        <p className="mt-4 text-[12px] font-bold">{t('ai.styles')}</p>
        <div className="mt-2 grid grid-cols-5 gap-2" role="radiogroup" aria-label={t('ai.styles')}>
          {props.styles.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={style === s.id}
              onClick={() => setStyle(s.id)}
              className={`rounded-[12px] border-2 p-1 ${style === s.id ? 'border-brand' : 'border-transparent'}`}
              data-testid={`ai-style-${s.id}`}
            >
              <span
                className={`block aspect-square rounded-[8px] bg-gradient-to-br ${STYLE_SWATCH[s.id] ?? ''}`}
              />
              <span className="mt-1 block text-[10px] font-bold leading-tight">{s.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-black/40 px-3 py-1" data-testid="ai-quota">
            {t('ai.quota', { text: quota.textLeft, image: quota.imageLeft })}
          </span>
          {props.text ? null : (
            <span className="rounded-full bg-black/40 px-3 py-1 text-white/60">{t('ai.textOff')}</span>
          )}
          {props.image ? null : (
            <span className="rounded-full bg-black/40 px-3 py-1 text-white/60">{t('ai.imageOff')}</span>
          )}
          {props.budgetOk ? null : (
            <span className="rounded-full bg-black/40 px-3 py-1 text-red-300">{t('ai.err.BUDGET')}</span>
          )}
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={generating || (!canText && !canImage)}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-black shadow-[0_0_20px_rgb(255_107_0/0.5)] disabled:opacity-60"
          data-testid="ai-generate"
        >
          <Sparkles className="h-5 w-5" aria-hidden /> {generating ? t('ai.generating') : t('ai.generate')}
        </button>
        <p className="mt-2 text-[11px] text-white/60">{t('ai.privacy')}</p>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300"
          data-testid="ai-error"
        >
          {error}
        </p>
      ) : null}

      {generating && images.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[16px] bg-white/10" />
          ))}
        </div>
      ) : null}

      {images.length > 0 ? (
        <section>
          <p className="flex items-center gap-1 text-[13px] font-black">
            <ImageIcon className="h-4 w-4" aria-hidden /> {t('ai.images', { style: styleName })}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            {images.map((img) => {
              const order = selected.indexOf(img.id);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => toggle(img.id)}
                  aria-pressed={order >= 0}
                  className={`relative aspect-square overflow-hidden rounded-[16px] border-4 ${order >= 0 ? 'border-brand' : 'border-transparent opacity-60'}`}
                  data-testid="ai-image"
                >
                  <Image
                    src={img.thumbUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                    unoptimized
                  />
                  {order >= 0 ? (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-[12px] font-black">
                      {order + 1}
                    </span>
                  ) : null}
                  {order === 0 ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold">
                      {t('ai.main')}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {fieldError('images')}
        </section>
      ) : null}

      {images.length > 0 || copy ? (
        <section className="grid gap-3 md:grid-cols-2">
          <div className="relative flex min-h-[180px] flex-col overflow-hidden rounded-[16px] border border-white/10 bg-white/5 p-3">
            <p className="flex items-center gap-1 text-[12px] font-black">
              <Video className="h-4 w-4" aria-hidden /> {t('ai.video')}
            </p>
            {slideshow?.status === 'done' && slideshow.url ? (
              <>
                <video
                  src={slideshow.url}
                  controls
                  muted
                  playsInline
                  className="mt-2 max-h-[320px] w-full rounded-[12px] bg-black object-contain"
                  data-testid="ai-video"
                />
                <label className="mt-2 flex items-center gap-2 text-[13px] font-bold">
                  <input
                    type="checkbox"
                    checked={withVideo}
                    onChange={(e) => setWithVideo(e.target.checked)}
                    className="h-5 w-5 accent-brand"
                    data-testid="ai-with-video"
                  />
                  {t('ai.withVideo')}
                </label>
              </>
            ) : (
              <button
                type="button"
                onClick={makeVideo}
                disabled={
                  selected.length === 0 ||
                  videoBusy ||
                  slideshow?.status === 'queued' ||
                  slideshow?.status === 'running'
                }
                className="mt-3 h-11 rounded-full border border-white/20 text-[13px] font-bold disabled:opacity-60"
                data-testid="ai-make-video"
              >
                {slideshow && slideshow.status !== 'failed' ? t('ai.videoWorking') : t('ai.makeVideo')}
              </button>
            )}
            {slideshow?.status === 'failed' ? (
              <p className="mt-2 text-[12px] text-red-300">{t('ai.videoFailed')}</p>
            ) : null}
          </div>
          {copy && canSpeak ? (
            <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
              <p className="flex items-center gap-1 text-[12px] font-black">
                <Mic className="h-4 w-4" aria-hidden /> {t('ai.voice')}
              </p>
              <p className="mt-1 text-[11px] text-white/60">{t('ai.voiceHint')}</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => speak(l.code)}
                    className="h-9 rounded-[10px] bg-white/10 text-[11px] font-bold hover:bg-brand"
                  >
                    {l.short}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {images.length > 0 || copy ? (
        <section className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
          <p className="text-[13px] font-black">{t('ai.copy')}</p>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t('ai.description')}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={9}
              maxLength={5000}
              className={area}
              data-testid="ai-description"
            />
            {fieldError('description')}
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t('ai.caption')}
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={300}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t('ai.stock')}
            <input
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              className={`${field} max-w-[160px]`}
              data-testid="ai-stock"
            />
            {fieldError('stock')}
          </label>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-black text-black disabled:opacity-60"
            data-testid="ai-publish"
          >
            <Rocket className="h-5 w-5" aria-hidden />
            {publishing ? t('ai.publishing') : t('ai.publish', { price: formatVnd(Number(price) || 0) })}
          </button>
        </section>
      ) : null}
    </div>
  );
}
