import { MapPin, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { KiotProductGrid } from '@/components/profile/KiotProductGrid';
import type { getT } from '@/i18n/server';
import type { KiotLayout, KiotPalette, KiotTemplate, ProductCard } from '@/modules/kiot';

// Các khối trên trang Kiot theo giao diện chủ Kiot chọn (SPEC-kiot.md V5.3): Sản phẩm nổi bật, Đánh giá, Liên hệ, Bản
// đồ — đúng thứ tự đã kéo. Ảnh bìa, Giới thiệu, Mạng xã hội, Sự kiện, Lưới sản phẩm, Video, Live bật/tắt ngay ở chỗ cũ.
export function KiotBlocks({
  layout,
  template,
  palette,
  featured,
  basePath,
  phone,
  locationText,
  rating,
  t,
}: {
  layout: KiotLayout;
  template: KiotTemplate;
  palette: KiotPalette;
  featured: ProductCard[];
  basePath: string;
  phone: string;
  locationText: string | null;
  rating: { avg: number; count: number } | null;
  t: Awaited<ReturnType<typeof getT>>;
}) {
  const local = '0' + phone.replace(/^\+84/, '');
  const button = 'flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-black';
  const center = template.align === 'center' ? 'text-center' : '';
  const sections = layout.blocks
    .filter((b) => b.on)
    .map((b) => {
      switch (b.id) {
        case 'featured':
          return featured.length ? (
            <section key={b.id} data-testid="kiot-block-featured">
              <h2 className={`mb-2 text-[14px] font-black ${center}`} style={{ color: palette.accent }}>
                ★ {t('seller.builder.block.featured')}
              </h2>
              <KiotProductGrid items={featured} basePath={basePath} />
            </section>
          ) : null;
        case 'reviews':
          return rating ? (
            <p
              key={b.id}
              className={`text-[13px] font-bold ${center}`}
              style={{ color: palette.accent }}
              data-testid="kiot-block-reviews"
            >
              ★ {rating.avg.toLocaleString(t.lang)} · {t('shop.review.section', { count: rating.count })}
            </p>
          ) : null;
        case 'contact':
          return (
            <div key={b.id} className="flex gap-2" data-testid="kiot-block-contact">
              <a
                href={`https://zalo.me/${local}`}
                target="_blank"
                rel="noopener noreferrer"
                className={button}
                style={{ backgroundColor: palette.accent, color: palette.onAccent }}
              >
                <MessageCircle className="h-4 w-4" aria-hidden /> Zalo
              </a>
              <a href={`tel:${phone}`} className={`${button} bg-white/10`}>
                <Phone className="h-4 w-4" aria-hidden /> {t('market.p.call')}
              </a>
            </div>
          );
        case 'map':
          return locationText ? (
            <Link
              key={b.id}
              href="/cho/ban-do"
              className={`flex items-center gap-1 text-[13px] font-bold ${center}`}
              data-testid="kiot-block-map"
            >
              <MapPin className="h-4 w-4" aria-hidden style={{ color: palette.accent }} /> {locationText}
            </Link>
          ) : null;
        default:
          return null;
      }
    })
    .filter(Boolean);
  if (!sections.length) return null;
  return (
    <div
      className="mt-4 flex flex-col gap-4 rounded-[18px] p-4"
      style={{ backgroundColor: palette.surface }}
      data-testid="kiot-blocks"
      data-template={template.id}
      data-palette={palette.id}
    >
      {sections}
    </div>
  );
}
