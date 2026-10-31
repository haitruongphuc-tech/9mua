import { MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { MessageButton } from '@/components/inbox/MessageButton';
import { PreviewBanner } from '@/components/kiot/PreviewBanner';
import { ProductDescription } from '@/components/kiot/ProductDescription';
import { ProductGallery } from '@/components/kiot/ProductGallery';
import { ReportProduct } from '@/components/market/ReportProduct';
import { AddToCart } from '@/components/orders/AddToCart';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { getCurrentUser } from '@/modules/identity';
import { CATEGORIES, getPublicProduct, kiotOwnerId, productPath } from '@/modules/kiot';
import { productReviews } from '@/modules/orders';
import { productVariants, variantPriceRange } from '@/modules/kiot';
import { isFeatureOn } from '@/lib/features';
import { ProductReviews } from './ProductReviews';
import { badgesForKiot, badgeStyle } from '@/server/kiot-badges';
import { KiotBadgeRow } from '@/components/kiot/KiotBadgeRow';
import { kiotBasePath, kiotCanonical } from '../../../kiot-context';

const viewer = cache(getCurrentUser);
const load = cache(async (slug: string, path: string) => {
  const id = path.split('-')[0] ?? '';
  return getPublicProduct(slug, id, (await viewer())?.id ?? null);
});

type Params = {
  params: Promise<{ slug: string; productPath: string }>;
  searchParams?: Promise<{ sao?: string; 'co-anh'?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, productPath: path } = await params;
  const found = await load(slug, path);
  if (!found) return { title: 'Không tìm thấy sản phẩm', robots: { index: false } };
  const { product, kiot, preview } = found;
  const description = `${formatVnd(product.price)} · ${kiot.name}${product.description ? ` — ${product.description.slice(0, 140)}` : ''}`;
  const url = kiotCanonical(slug, productPath(product));
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    robots: preview ? { index: false } : undefined,
    openGraph: {
      type: 'website',
      title: `${product.name} — ${formatVnd(product.price)}`,
      description,
      url,
      images: product.images[0]
        ? [{ url: product.images[0].url, width: product.images[0].width, height: product.images[0].height }]
        : ['/og-default.png'],
    },
    other: { 'product:price:amount': String(product.price), 'product:price:currency': 'VND' },
  };
}

const contact = 'flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-black';

// Trang sản phẩm kiểu V4: ảnh trên nền trắng, giá cam, nút giỏ cam, liên hệ Zalo/Gọi.
export default async function ProductPage({ params, searchParams }: Params) {
  const { slug, productPath: path } = await params;
  const found = await load(slug, path);
  if (!found) notFound();
  const { product, kiot, preview } = found;
  const ownerId = await kiotOwnerId(kiot.id);
  const [base, t] = await Promise.all([kiotBasePath(slug), getT()]);
  // Tên sản phẩm đổi thì đường dẫn cũ chuyển về đường dẫn đúng.
  if (`/p/${path}` !== productPath(product)) permanentRedirect(`${base}${productPath(product)}`);
  const category = CATEGORIES.find((c) => c.slug === product.category);
  const local = '0' + kiot.contactPhone.replace(/^\+84/, '');
  // Đánh giá (SPEC-orders.md V5.1 mục 6), công tắc reviews.
  const query = (await searchParams) ?? {};
  const reviewFilter = {
    stars: [1, 2, 3, 4, 5].find((s) => String(s) === query.sao),
    withMedia: query['co-anh'] === '1',
  };
  // Biến thể (SPEC-kiot.md V5.6): sản phẩm đã có biến thể vẫn bán khi công tắc tắt.
  const variants = await productVariants(product.id);
  const priceRange = variants.length ? await variantPriceRange(product.id) : null;
  const badges = (await isFeatureOn('origin')) ? await badgesForKiot(kiot.id) : null;
  const badgeLook = badges?.level ? await badgeStyle() : null;
  const reviews =
    !preview && (await isFeatureOn('reviews')) ? await productReviews(product.id, reviewFilter) : null;

  return (
    <ClientMessages prefixes={['market.p.', 'market.report.', 'shop.add.', 'shop.cart.qty']}>
      <article className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 md:flex-row">
        <div className="md:w-1/2">
          {preview ? <PreviewBanner /> : null}
          <ProductGallery images={product.images} name={product.name} />
        </div>
        <div className="flex flex-col gap-4 md:w-1/2">
          <Link href={base || '/'} className="text-[13px] font-bold text-brand">
            ← {kiot.name}
          </Link>
          <h1 className="font-display text-[24px] font-black leading-tight">{product.name}</h1>
          {badges && badgeLook ? <KiotBadgeRow badges={badges} style={badgeLook} /> : null}
          <p className="flex items-baseline gap-3">
            <span className="text-3xl font-black text-brand" data-testid="product-price">
              {priceRange && priceRange.min !== priceRange.max
                ? `${formatVnd(priceRange.min)} – ${formatVnd(priceRange.max)}`
                : formatVnd(priceRange?.min ?? product.price)}
            </span>
            {product.compareAtPrice ? (
              <span className="text-white/50 line-through">{formatVnd(product.compareAtPrice)}</span>
            ) : null}
          </p>
          {product.warranty && (await isFeatureOn('kiot_builder')) ? (
            <p className="text-[13px] font-bold text-green-300" data-testid="product-warranty">
              🛡 {product.warranty}
            </p>
          ) : null}
          <p className="text-[13px] text-white/60">
            {category ? `${category.icon} ${t(`market.cat.${category.slug}`)}` : t('market.cat.khac')} ·{' '}
            {product.stock > 0 ? t('market.p.left', { stock: product.stock }) : t('market.soldOut')}
          </p>
          {preview ? null : (
            <AddToCart
              productId={product.id}
              maxQty={variants.length ? Math.max(0, ...variants.map((v) => v.stock)) : product.stock}
              cartUrl={`${env().APP_URL}/gio-hang`}
              variants={variants.map((v) => ({
                id: v.id,
                label: v.label,
                priceText: formatVnd(v.price),
                stock: v.stock,
              }))}
            />
          )}
          {preview || !ownerId ? null : (
            <MessageButton
              kind="ask"
              toUserId={ownerId}
              productId={product.id}
              loginHref={`${env().APP_URL}/dang-nhap?next=${encodeURIComponent('/hop-thu')}`}
            />
          )}
          <div className="flex gap-2">
            <a
              href={`https://zalo.me/${local}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${contact} bg-[#0068FF]`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden /> {t('market.p.zalo')}
            </a>
            <a href={`tel:${kiot.contactPhone}`} className={`${contact} bg-white/10`}>
              <Phone className="h-4 w-4" aria-hidden /> {t('market.p.call')}
            </a>
          </div>
          {product.description ? (
            <section className="border-t border-white/10 pt-4" aria-labelledby="mo-ta">
              <h2 id="mo-ta" className="mb-2 font-display text-[16px] font-black">
                {t('market.p.description')}
              </h2>
              <ProductDescription text={product.description} />
            </section>
          ) : null}
          {reviews ? (
            <ProductReviews
              summary={reviews.summary}
              items={reviews.items}
              filter={reviewFilter}
              basePath={`${base}${productPath(product)}`}
              loggedIn={Boolean(await viewer())}
              t={t}
            />
          ) : null}
          {!preview && (await isFeatureOn('fake_report')) ? (
            <a
              href={`${env().APP_URL}/to-cao-hang-gia?sp=${product.id}`}
              className="text-[12px] font-bold text-red-300 hover:underline"
              data-testid="fake-report-link"
            >
              ⚠ {t('shop.fake.title')}
            </a>
          ) : null}
          {preview ? null : (
            <ReportProduct
              productId={product.id}
              loginUrl={
                (await viewer())
                  ? null
                  : `${env().APP_URL}/dang-nhap?next=${encodeURIComponent(`/k/${slug}${productPath(product)}`)}`
              }
            />
          )}
        </div>
      </article>
    </ClientMessages>
  );
}
