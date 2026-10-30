import { db } from '@/lib/db';
import { kiotOrigin } from '@/lib/urls';
import { getVideo } from '@/modules/creator';
import { getKiotByOwner, getProductForCheckout, kiotBasics, productPath } from '@/modules/kiot';

export type ProductCard = { id: string; name: string; price: number; imageUrl: string | null; url: string };
// Thẻ video (SPEC-messages.md V5.1): người xem tin không được xem video thì available = false ("Video không còn xem được").
export type VideoCard = {
  id: string;
  available: boolean;
  posterUrl: string | null;
  caption: string;
  authorName: string;
};
export type MessageView = {
  id: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  product: ProductCard | null;
  video: VideoCard | null;
  createdAt: string;
  hidden: boolean;
};
// avatarUrl: logo Kiot nếu người đó có Kiot (tên hiện là tên Kiot), không thì ảnh đại diện (SPEC-social.md bổ sung 30/10).
export type ConversationPeer = {
  id: string;
  displayName: string;
  kiotName: string | null;
  avatarUrl: string | null;
};

type Row = {
  id: string;
  senderId: string;
  text: string | null;
  imageId: string | null;
  productId: string | null;
  videoId?: string | null;
  createdAt: Date;
  hiddenAt: Date | null;
};

export const imageUrl = (imageId: string) => `/api/hop-thu/anh/${imageId}`;

// Thẻ sản phẩm: chỉ hiện khi sản phẩm còn bán (Kiot hết hạn hay sản phẩm bị ẩn thì thẻ tự ẩn).
export async function productCards(ids: string[]): Promise<Map<string, ProductCard>> {
  const unique = [...new Set(ids)];
  const products = (await Promise.all(unique.map((id) => getProductForCheckout(id)))).filter(
    (p): p is NonNullable<typeof p> => Boolean(p?.available),
  );
  const kiots = await kiotBasics([...new Set(products.map((p) => p.kiotId))]);
  const map = new Map<string, ProductCard>();
  for (const p of products) {
    const k = kiots.find((x) => x.id === p.kiotId);
    if (k)
      map.set(p.id, {
        id: p.id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        url: `${kiotOrigin(k.slug)}${productPath(p)}`,
      });
  }
  return map;
}

export async function productCardOf(productId: string): Promise<ProductCard | null> {
  return (await productCards([productId])).get(productId) ?? null;
}

// Thẻ video theo quyền xem của người đang xem tin (video riêng tư, bị chặn, bị gỡ thì không hiện nội dung).
async function videoCards(ids: string[], viewerId: string | undefined): Promise<Map<string, VideoCard>> {
  const map = new Map<string, VideoCard>();
  for (const id of new Set(ids)) {
    const v = await getVideo(id, { userId: viewerId });
    map.set(
      id,
      v
        ? {
            id,
            available: true,
            posterUrl: v.posterUrl,
            caption: v.caption,
            authorName: v.author.displayName,
          }
        : { id, available: false, posterUrl: null, caption: '', authorName: '' },
    );
  }
  return map;
}

// reveal: CEO xem cuộc trò chuyện bị báo cáo thì thấy cả tin đã ẩn. viewerId: người đang xem (quyền xem thẻ video).
export async function toViews(rows: Row[], reveal = false, viewerId?: string): Promise<MessageView[]> {
  const cards = await productCards(rows.map((r) => r.productId).filter((x): x is string => Boolean(x)));
  const videos = await videoCards(
    rows.map((r) => r.videoId).filter((x): x is string => Boolean(x)),
    viewerId,
  );
  return rows.map((r) => {
    const hidden = Boolean(r.hiddenAt);
    const show = reveal || !hidden;
    return {
      id: r.id,
      senderId: r.senderId,
      text: show ? r.text : null,
      imageUrl: show && r.imageId ? imageUrl(r.imageId) : null,
      product: show && r.productId ? (cards.get(r.productId) ?? null) : null,
      video: show && r.videoId ? (videos.get(r.videoId) ?? null) : null,
      createdAt: r.createdAt.toISOString(),
      hidden,
    };
  });
}

export async function peers(ids: string[]): Promise<Map<string, ConversationPeer>> {
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const kiots = await Promise.all(users.map((u) => getKiotByOwner(u.id)));
  return new Map(
    users.map((u, i) => {
      const kiot = kiots[i];
      return [
        u.id,
        {
          id: u.id,
          displayName: u.displayName,
          kiotName: kiot?.name ?? null,
          avatarUrl: kiot ? kiot.logoUrl : u.avatarUrl,
        },
      ];
    }),
  );
}
