// Dữ liệu mẫu để CEO thử web trên VPS trước khi mở cửa (yêu cầu 26/10/2026). Chạy: scripts/seed-demo.ts.
// Chỉ tạo dữ liệu hiển thị: tài khoản người bán, Kiot, sản phẩm có ảnh, video. KHÔNG tạo đơn hàng hay thanh
// toán — sổ tiền chỉ được thêm, không xoá được, dữ liệu giả sẽ nằm mãi trong báo cáo tiền.
// Dấu hiệu nhận biết: tài khoản có email đuôi @demo.9mua.com. removeDemoData() dọn theo dấu hiệu đó.
import { randomBytes } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { imageStore, resolveUploadPath } from '@/lib/media/image-store';
import { createVideoUpload, saveUpload } from '@/modules/creator';
import { acceptCommitment, currentCommitment, register } from '@/modules/identity';
import {
  createKiot,
  createProduct,
  extendActiveUntil,
  lockKiot,
  setKiotImage,
  updateKiotAddress,
  uploadProductImage,
} from '@/modules/kiot';
import { DEMO_KIOTS, describeProduct } from './demo-catalog';

export const DEMO_EMAIL_DOMAIN = 'demo.9mua.com';
// Nút gọi/Zalo trên trang Kiot mẫu gọi về số CEO, không bịa số có thể trúng người lạ.
const CONTACT_PHONE = '0979393916';

const KIOTS = DEMO_KIOTS;
const PHOTOS_PER_PRODUCT = 3;

// Ảnh minh hoạ vẽ bằng hình khối (không dùng chữ: image không có font). Mỗi sản phẩm một bố cục khác nhau.
function artwork(colors: [string, string], seed: number, size: number): Promise<Buffer> {
  const [a, b] = colors;
  const shapes = [
    `<circle cx="50%" cy="52%" r="28%" fill="#fff" fill-opacity=".85"/><circle cx="62%" cy="40%" r="9%" fill="${b}"/>`,
    `<rect x="26%" y="22%" width="48%" height="56%" rx="8%" fill="#fff" fill-opacity=".85"/><rect x="38%" y="12%" width="24%" height="14%" rx="3%" fill="#fff" fill-opacity=".7"/>`,
    `<path d="M${size * 0.3} ${size * 0.25}h${size * 0.4}l${size * 0.12} ${size * 0.12}-${size * 0.08} ${size * 0.08}v${size * 0.4}h-${size * 0.48}v-${size * 0.4}l-${size * 0.08}-${size * 0.08}z" fill="#fff" fill-opacity=".85"/>`,
    `<ellipse cx="50%" cy="55%" rx="30%" ry="22%" fill="#fff" fill-opacity=".85"/><ellipse cx="50%" cy="35%" rx="14%" ry="10%" fill="${a}"/>`,
    `<polygon points="${size / 2},${size * 0.18} ${size * 0.8},${size * 0.78} ${size * 0.2},${size * 0.78}" fill="#fff" fill-opacity=".85"/>`,
    `<rect x="24%" y="30%" width="52%" height="40%" rx="20%" fill="#fff" fill-opacity=".85"/><circle cx="50%" cy="50%" r="8%" fill="${b}"/>`,
    `<circle cx="38%" cy="45%" r="18%" fill="#fff" fill-opacity=".8"/><circle cx="62%" cy="58%" r="18%" fill="#fff" fill-opacity=".6"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>${shapes[seed % shapes.length]}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export type SeedResult =
  | {
      ok: true;
      login: { email: string; password: string };
      kiots: number;
      products: number;
      videos: number;
      realPhotos: number; // số ảnh lấy được từ kho ảnh (còn lại là ảnh vẽ sẵn)
    }
  | { ok: false; error: 'ALREADY_SEEDED' };

// photos(query, shape, n): tối đa n ảnh thật (Pixabay/Pexels, src/server/stock-media.ts) theo từ khoá; không có
// hoặc lỗi thì dùng ảnh vẽ sẵn. makeVideo(i, query): nội dung file video thứ i, hoặc null để bỏ qua video.
export async function seedDemoData(options: {
  photos?: (query: string, shape: 'square' | 'landscape', count: number) => Promise<Buffer[]>;
  makeVideo: (index: number, query: string) => Promise<Buffer | null>;
  log?: (line: string) => void;
}): Promise<SeedResult> {
  const log = options.log ?? (() => {});
  if (await db.user.count({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } }))
    return { ok: false, error: 'ALREADY_SEEDED' };

  const fail = (step: string, result: unknown): never => {
    throw new Error(`Tạo dữ liệu mẫu lỗi ở bước ${step}: ${JSON.stringify(result)}`);
  };
  let login = { email: '', password: '' };
  let products = 0;
  let videos = 0;
  let realPhotos = 0;
  // Lưu tối đa `count` ảnh thật; ảnh nào không dùng được (lỗi mạng, ảnh hỏng, quá lớn) thì bỏ, không còn ảnh
  // nào thì dùng 1 ảnh vẽ sẵn.
  async function withPhotos<T extends { ok: boolean }>(
    query: string,
    shape: 'square' | 'landscape',
    count: number,
    fallback: () => Promise<Buffer>,
    save: (data: Buffer) => Promise<T>,
  ): Promise<T[]> {
    const saved: T[] = [];
    for (const data of (await options.photos?.(query, shape, count)) ?? []) {
      const result = await save(data);
      if (result.ok) saved.push(result);
      if (saved.length === count) break;
    }
    realPhotos += saved.length;
    return saved.length ? saved : [await save(await fallback())];
  }

  for (const [i, k] of KIOTS.entries()) {
    const email = `kiot${i + 1}@${DEMO_EMAIL_DOMAIN}`;
    const password = randomBytes(9).toString('base64url');
    if (i === 0) login = { email, password };
    const user = await register({ identifier: email, displayName: k.owner, password });
    if (!user.ok) fail('tài khoản', user);
    const userId = user.ok ? user.userId : '';

    // Tài khoản mẫu do CEO tạo: coi như đã đồng ý cam kết nội dung bản hiện tại (SPEC-identity.md V5.6).
    await acceptCommitment(userId, (await currentCommitment()).version, null, 'demo-data');
    const kiot = await createKiot(userId, {
      name: k.name,
      slug: k.slug,
      description: k.description,
      contactPhone: CONTACT_PHONE,
    });
    if (!kiot.ok) fail(`Kiot ${k.slug}`, kiot);
    const kiotId = kiot.ok ? kiot.kiotId : '';
    await updateKiotAddress(userId, { province: k.province, district: k.district, addressLine: '' });
    await withPhotos(
      k.queries.logo,
      'square',
      1,
      () => artwork(k.color, i, 400),
      (data) => setKiotImage(userId, 'logo', data),
    );
    await withPhotos(
      k.queries.cover,
      'landscape',
      1,
      () => artwork([k.color[1], k.color[0]], i + 3, 1200),
      (data) => setKiotImage(userId, 'cover', data),
    );
    // Kích hoạt 1 năm không qua thanh toán: không tạo KiotSubscription/PaymentIntent (không đụng sổ tiền).
    await db.$transaction((tx) =>
      extendActiveUntil(tx, kiotId, new Date(now().getTime() + 365 * 86_400_000)),
    );

    const productIds: string[] = [];
    for (const [j, p] of k.products.entries()) {
      const images = await withPhotos(
        p.query,
        'square',
        PHOTOS_PER_PRODUCT,
        () => artwork(k.color, j, 800),
        (data) => uploadProductImage(userId, data),
      );
      const imageIds = images.flatMap((img) => (img.ok ? [img.image.id] : []));
      if (!imageIds.length) fail(`ảnh ${p.name}`, images[0]);
      const created = await createProduct(userId, {
        name: p.name,
        description: describeProduct(p, k),
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        stock: p.stock,
        category: p.category,
        imageIds,
      });
      if (!created.ok) fail(`sản phẩm ${p.name}`, created);
      if (created.ok) productIds.push(created.productId);
    }
    products += productIds.length;

    const video = await options.makeVideo(i, k.queries.video);
    if (video) {
      const upload = await saveUpload(userId, Readable.from(video));
      if (!upload.ok) fail('tải video', upload);
      const created = await createVideoUpload(userId, upload.ok ? upload.uploadId : '', {
        caption: k.caption,
        productIds: productIds.slice(0, 3),
      });
      if (!created.ok) fail('tạo video', created);
      videos += 1;
    }
    log(`Đã tạo ${k.name}: ${productIds.length} sản phẩm${video ? ', 1 video' : ''}`);
  }
  return { ok: true, login, kiots: KIOTS.length, products, videos, realPhotos };
}

export type RemoveResult = {
  mode: 'deleted' | 'hidden';
  users: number;
  kiots: number;
  products: number;
  videos: number;
};

// Xoá toàn bộ dữ liệu mẫu (tài khoản @demo.9mua.com và mọi thứ của chúng, kể cả tương tác của người khác:
// giỏ hàng, thích, báo cáo) cùng file ảnh/video. Nếu dữ liệu mẫu đã dính tới tiền (đơn hàng, số dư, doanh
// thu) thì không xoá được vì các sổ đó chỉ thêm: khi ấy khoá tài khoản, khoá Kiot, ẩn sản phẩm và video.
export async function removeDemoData(): Promise<RemoveResult> {
  const users = await db.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const kiots = await db.kiot.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true, logoUrl: true, coverUrl: true },
  });
  const kiotIds = kiots.map((k) => k.id);
  const products = await db.product.findMany({ where: { kiotId: { in: kiotIds } }, select: { id: true } });
  const productIds = products.map((p) => p.id);
  const videos = await db.video.findMany({
    where: { authorId: { in: userIds } },
    select: { id: true, fileUrl: true, posterUrl: true },
  });
  const videoIds = videos.map((v) => v.id);
  const counts = {
    users: users.length,
    kiots: kiots.length,
    products: products.length,
    videos: videos.length,
  };

  const touchesMoney =
    (await db.order.count({ where: { OR: [{ kiotId: { in: kiotIds } }, { buyerId: { in: userIds } }] } })) +
      (await db.orderItem.count({
        where: { OR: [{ productId: { in: productIds } }, { sourceVideoId: { in: videoIds } }] },
      })) +
      (await db.balanceEntry.count({ where: { kiotId: { in: kiotIds } } })) +
      (await db.platformRevenue.count({ where: { kiotId: { in: kiotIds } } })) +
      (await db.kiotSubscription.count({ where: { kiotId: { in: kiotIds } } })) >
    0;

  if (touchesMoney) {
    for (const id of kiotIds) await lockKiot(id, 'Dữ liệu mẫu đã gỡ');
    await db.$transaction([
      db.product.updateMany({
        where: { id: { in: productIds }, deletedAt: null },
        data: { deletedAt: now() },
      }),
      db.video.updateMany({ where: { id: { in: videoIds } }, data: { status: 'removed' } }),
      db.user.updateMany({ where: { id: { in: userIds } }, data: { lockedAt: now() } }),
      db.session.deleteMany({ where: { userId: { in: userIds } } }),
    ]);
    return { mode: 'hidden', ...counts };
  }

  const images = await db.productImage.findMany({
    where: { kiotId: { in: kiotIds } },
    select: { url: true, thumbUrl: true },
  });
  const kycFiles = await db.kycSubmission.findMany({
    where: { userId: { in: userIds } },
    select: { frontImage: true, backImage: true },
  });
  const inVideos = { videoId: { in: videoIds } };
  await db.$transaction([
    db.videoLike.deleteMany({ where: { OR: [inVideos, { userId: { in: userIds } }] } }),
    db.videoView.deleteMany({ where: inVideos }),
    db.videoReport.deleteMany({ where: { OR: [inVideos, { userId: { in: userIds } }] } }),
    db.videoProduct.deleteMany({ where: { OR: [inVideos, { productId: { in: productIds } }] } }),
    db.videoJob.deleteMany({ where: inVideos }),
    db.video.deleteMany({ where: { id: { in: videoIds } } }),
    db.cartItem.deleteMany({
      where: { OR: [{ productId: { in: productIds } }, { userId: { in: userIds } }] },
    }),
    db.productReport.deleteMany({
      where: { OR: [{ productId: { in: productIds } }, { reporterId: { in: userIds } }] },
    }),
    db.productSalesStat.deleteMany({ where: { productId: { in: productIds } } }),
    db.productImage.deleteMany({ where: { kiotId: { in: kiotIds } } }),
    db.product.deleteMany({ where: { id: { in: productIds } } }),
    db.kiotPayoutAccount.deleteMany({ where: { kiotId: { in: kiotIds } } }),
    db.billingReminder.deleteMany({ where: { kiotId: { in: kiotIds } } }),
    db.payoutRequest.deleteMany({ where: { kiotId: { in: kiotIds } } }),
    db.kiot.deleteMany({ where: { id: { in: kiotIds } } }),
    db.kycSubmission.deleteMany({ where: { userId: { in: userIds } } }),
    db.checkout.deleteMany({ where: { buyerId: { in: userIds } } }),
    db.notification.deleteMany({ where: { userId: { in: userIds } } }),
    db.user.deleteMany({ where: { id: { in: userIds } } }), // phiên, giỏ hàng, địa chỉ xoá theo (cascade)
  ]);

  const store = imageStore();
  const urls = [
    ...images.flatMap((i) => [i.url, i.thumbUrl]),
    ...kiots.flatMap((k) => [k.logoUrl, k.coverUrl]),
    ...videos.flatMap((v) => [v.fileUrl, v.posterUrl]),
  ];
  for (const url of urls) if (url) await store.remove(url);
  for (const userId of userIds) {
    const dir = resolveUploadPath(env().PRIVATE_DIR, ['video-uploads', userId]);
    if (dir) await rm(dir, { recursive: true, force: true });
  }
  for (const f of kycFiles.flatMap((k) => [k.frontImage, k.backImage])) {
    const file = resolveUploadPath(env().PRIVATE_DIR, f.split('/'));
    if (file) await rm(file, { force: true });
  }
  return { mode: 'deleted', ...counts };
}
