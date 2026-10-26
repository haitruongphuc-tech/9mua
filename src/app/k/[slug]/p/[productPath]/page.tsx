import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { ContactButtons } from '@/components/kiot/ContactButtons';
import { PreviewBanner } from '@/components/kiot/PreviewBanner';
import { ProductGallery } from '@/components/kiot/ProductGallery';
import { ReportProduct } from '@/components/market/ReportProduct';
import { AddToCart } from '@/components/orders/AddToCart';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { getCurrentUser } from '@/modules/identity';
import { categoryName, getPublicProduct, productPath } from '@/modules/kiot';
import { kiotBasePath, kiotCanonical } from '../../../kiot-context';

const viewer = cache(getCurrentUser);
const load = cache(async (slug: string, path: string) => {
  const id = path.split('-')[0] ?? '';
  return getPublicProduct(slug, id, (await viewer())?.id ?? null);
});

type Params = { params: Promise<{ slug: string; productPath: string }> };

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

export default async function ProductPage({ params }: Params) {
  const { slug, productPath: path } = await params;
  const found = await load(slug, path);
  if (!found) notFound();
  const { product, kiot, preview } = found;
  const base = await kiotBasePath(slug);
  // Tên sản phẩm đổi thì đường dẫn cũ chuyển về đường dẫn đúng.
  if (`/p/${path}` !== productPath(product)) permanentRedirect(`${base}${productPath(product)}`);

  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 md:flex-row">
      <div className="md:w-1/2">
        {preview ? <PreviewBanner /> : null}
        <ProductGallery images={product.images} name={product.name} />
      </div>
      <div className="flex flex-col gap-4 md:w-1/2">
        <Link href={base || '/'} className="text-sm font-bold text-brand-deep">
          ← {kiot.name}
        </Link>
        <h1 className="text-2xl font-extrabold leading-tight">{product.name}</h1>
        <p className="flex items-baseline gap-3">
          <span className="text-3xl font-extrabold text-brand-deep" data-testid="product-price">
            {formatVnd(product.price)}
          </span>
          {product.compareAtPrice ? (
            <span className="text-black/60 line-through">{formatVnd(product.compareAtPrice)}</span>
          ) : null}
        </p>
        <p className="text-sm text-black/70">
          {categoryName(product.category)} · {product.stock > 0 ? `Còn ${product.stock}` : 'Hết hàng'}
        </p>
        {preview ? null : (
          <AddToCart productId={product.id} maxQty={product.stock} cartUrl={`${env().APP_URL}/gio-hang`} />
        )}
        <ContactButtons phone={kiot.contactPhone} />
        {product.description ? (
          <section className="border-t border-black/10 pt-4" aria-labelledby="mo-ta">
            <h2 id="mo-ta" className="mb-2 text-lg font-extrabold">
              Mô tả sản phẩm
            </h2>
            <div
              className="whitespace-pre-line leading-relaxed text-black/85"
              data-testid="product-description"
            >
              {product.description}
            </div>
          </section>
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
  );
}
