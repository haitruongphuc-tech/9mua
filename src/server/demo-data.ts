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
import { register } from '@/modules/identity';
import {
  createKiot,
  createProduct,
  extendActiveUntil,
  lockKiot,
  setKiotImage,
  updateKiotAddress,
  uploadProductImage,
} from '@/modules/kiot';

export const DEMO_EMAIL_DOMAIN = 'demo.9mua.com';
// Nút gọi/Zalo trên trang Kiot mẫu gọi về số CEO, không bịa số có thể trúng người lạ.
const CONTACT_PHONE = '0979393916';

// query: từ khoá tiếng Anh để tìm ảnh thật trên Pexels (kho ảnh tiếng Anh cho kết quả đúng hơn).
type DemoProduct = [
  name: string,
  price: number,
  compareAtPrice: number | null,
  stock: number,
  category: string,
  query: string,
];
type DemoKiot = {
  slug: string;
  name: string;
  owner: string;
  description: string;
  province: string;
  district: string;
  color: [string, string];
  caption: string;
  queries: { logo: string; cover: string; video: string };
  products: DemoProduct[];
};

const KIOTS: DemoKiot[] = [
  {
    slug: 'mau-traicay',
    name: 'Trái cây Miền Tây (Mẫu)',
    owner: 'Chị Ngọc (Mẫu)',
    description: 'Trái cây tươi hái tại vườn Cần Thơ, giao trong ngày. Đây là Kiot mẫu để thử web.',
    province: 'can-tho',
    district: 'Ninh Kiều',
    color: ['#f59e0b', '#16a34a'],
    caption: 'Xoài cát chín cây, ngọt lịm #traicay #mientay #mau',
    queries: { logo: 'tropical fruit', cover: 'fruit market stall', video: 'tropical fruit' },
    products: [
      ['Xoài cát Hòa Lộc loại 1 (1kg)', 65_000, 80_000, 120, 'nong-san', 'mango fruit'],
      ['Sầu riêng Ri6 nguyên trái (2–3kg)', 145_000, null, 40, 'nong-san', 'durian fruit'],
      ['Bưởi da xanh Bến Tre (1 trái)', 55_000, 70_000, 80, 'nong-san', 'pomelo'],
      ['Chôm chôm nhãn (1kg)', 45_000, null, 60, 'nong-san', 'rambutan'],
      ['Thanh long ruột đỏ (1kg)', 35_000, 42_000, 150, 'nong-san', 'dragon fruit'],
      ['Mít Thái sấy giòn (500g)', 89_000, null, 200, 'thuc-pham-dac-san', 'dried fruit snack'],
      ['Combo trái cây biếu Tết', 450_000, 520_000, 15, 'thuc-pham-dac-san', 'fruit gift basket'],
    ],
  },
  {
    slug: 'mau-thoitrang',
    name: 'Thời trang Phố Cổ (Mẫu)',
    owner: 'Anh Tuấn (Mẫu)',
    description: 'Áo quần may sẵn, chất liệu cotton thoáng mát. Đây là Kiot mẫu để thử web.',
    province: 'ha-noi',
    district: 'Hoàn Kiếm',
    color: ['#6366f1', '#ec4899'],
    caption: 'Áo thun mới về, đủ size #thoitrang #aothun #mau',
    queries: { logo: 'clothing store', cover: 'clothing rack boutique', video: 'fashion clothes' },
    products: [
      ['Áo thun cotton trơn unisex', 129_000, 159_000, 300, 'thoi-trang', 'white t-shirt'],
      ['Áo sơ mi linen tay ngắn', 249_000, null, 80, 'thoi-trang', 'linen shirt'],
      ['Quần jean ống suông nữ', 299_000, 359_000, 60, 'thoi-trang', 'women jeans'],
      ['Váy hoa nhí dáng dài', 319_000, null, 45, 'thoi-trang', 'floral dress'],
      ['Áo khoác gió 2 lớp', 389_000, 450_000, 70, 'thoi-trang', 'windbreaker jacket'],
      ['Túi tote vải canvas', 99_000, null, 120, 'thoi-trang', 'canvas tote bag'],
      ['Mũ bucket thêu chữ', 79_000, 99_000, 90, 'thoi-trang', 'bucket hat'],
    ],
  },
  {
    slug: 'mau-mypham',
    name: 'Mỹ phẩm Thiên Nhiên (Mẫu)',
    owner: 'Chị Hoa (Mẫu)',
    description: 'Mỹ phẩm chiết xuất thiên nhiên, có giấy kiểm định. Đây là Kiot mẫu để thử web.',
    province: 'tp-ho-chi-minh',
    district: 'Quận 3',
    color: ['#f472b6', '#a855f7'],
    caption: 'Son dưỡng môi từ sáp ong #mypham #sonduong #mau',
    queries: { logo: 'cosmetics', cover: 'skincare products', video: 'skincare' },
    products: [
      ['Son dưỡng môi sáp ong', 85_000, 110_000, 200, 'my-pham', 'lip balm'],
      ['Sữa rửa mặt nghệ tươi (150ml)', 125_000, null, 150, 'my-pham', 'facial cleanser'],
      ['Nước hoa hồng không cồn (200ml)', 159_000, 189_000, 90, 'my-pham', 'toner bottle skincare'],
      ['Kem chống nắng SPF50 (50ml)', 219_000, null, 75, 'my-pham', 'sunscreen'],
      ['Dầu gội bồ kết (300ml)', 99_000, 120_000, 130, 'my-pham', 'shampoo bottle'],
      ['Mặt nạ đất sét (100g)', 139_000, null, 60, 'my-pham', 'clay face mask'],
    ],
  },
  {
    slug: 'mau-giadung',
    name: 'Gia dụng Tiện Ích (Mẫu)',
    owner: 'Anh Minh (Mẫu)',
    description: 'Đồ gia dụng và phụ kiện điện thoại giá tốt. Đây là Kiot mẫu để thử web.',
    province: 'da-nang',
    district: 'Hải Châu',
    color: ['#0ea5e9', '#14b8a6'],
    caption: 'Nồi chiên không dầu cho gia đình #giadung #bep #mau',
    queries: { logo: 'kitchen utensils', cover: 'modern kitchen', video: 'kitchen cooking' },
    products: [
      ['Nồi chiên không dầu 5 lít', 1_290_000, 1_590_000, 25, 'do-gia-dung', 'air fryer'],
      ['Bình giữ nhiệt inox 500ml', 189_000, null, 140, 'do-gia-dung', 'thermos bottle'],
      ['Bộ hộp đựng thực phẩm 5 món', 159_000, 199_000, 85, 'do-gia-dung', 'food storage containers'],
      ['Tai nghe bluetooth chống ồn', 459_000, 590_000, 50, 'dien-tu', 'wireless headphones'],
      ['Sạc dự phòng 10.000mAh', 299_000, null, 100, 'dien-tu', 'power bank'],
      ['Cáp sạc nhanh Type-C 1m', 59_000, 79_000, 400, 'dien-tu', 'usb cable'],
      ['Đèn ngủ cảm ứng để bàn', 149_000, null, 65, 'do-gia-dung', 'bedside lamp'],
    ],
  },
  {
    slug: 'mau-dacsan',
    name: 'Đặc sản Tây Bắc (Mẫu)',
    owner: 'Chú Sùng (Mẫu)',
    description:
      'Đặc sản vùng cao: thịt trâu gác bếp, mật ong rừng, chè Shan tuyết. Đây là Kiot mẫu để thử web.',
    province: 'dien-bien',
    district: 'Mường Thanh',
    color: ['#b45309', '#7c2d12'],
    caption: 'Thịt trâu gác bếp chuẩn vị Tây Bắc #dacsan #taybac #mau',
    queries: { logo: 'mountain village', cover: 'rice terraces', video: 'honey' },
    products: [
      ['Thịt trâu gác bếp (500g)', 450_000, 520_000, 40, 'thuc-pham-dac-san', 'smoked meat'],
      ['Mật ong rừng nguyên chất (1 lít)', 380_000, null, 30, 'thuc-pham-dac-san', 'honey jar'],
      ['Chè Shan tuyết cổ thụ (200g)', 260_000, 300_000, 50, 'thuc-pham-dac-san', 'green tea leaves'],
      ['Lạp xưởng hun khói (500g)', 220_000, null, 45, 'thuc-pham-dac-san', 'chinese sausage'],
      ['Gạo nếp nương (2kg)', 120_000, 140_000, 70, 'nong-san', 'sticky rice'],
      ['Giỏ mây đan tay', 180_000, null, 20, 'thu-cong-my-nghe', 'rattan basket'],
    ],
  },
  {
    slug: 'mau-mevabe',
    name: 'Mẹ và Bé Xinh (Mẫu)',
    owner: 'Chị Mai (Mẫu)',
    description: 'Đồ dùng cho mẹ, bé và thú cưng trong nhà. Đây là Kiot mẫu để thử web.',
    province: 'hai-phong',
    district: 'Lê Chân',
    color: ['#22c55e', '#facc15'],
    caption: 'Bộ đồ sơ sinh cotton mềm mịn #mevabe #sosinh #mau',
    queries: { logo: 'baby', cover: 'nursery room', video: 'baby toys' },
    products: [
      ['Bộ đồ sơ sinh cotton (3 bộ)', 189_000, 229_000, 100, 'me-va-be', 'baby clothes'],
      ['Khăn sữa sợi tre (10 cái)', 99_000, null, 160, 'me-va-be', 'muslin cloth baby'],
      ['Bình sữa thuỷ tinh 240ml', 249_000, 289_000, 55, 'me-va-be', 'baby bottle'],
      ['Đồ chơi gỗ xếp hình', 159_000, null, 70, 'me-va-be', 'wooden toys'],
      ['Thức ăn hạt cho mèo (1,5kg)', 179_000, 199_000, 90, 'thu-cung', 'cat food'],
      ['Sách tô màu cho bé', 45_000, null, 200, 'sach-van-phong-pham', 'coloring book'],
      ['Sữa tắm thảo dược cho bé', 135_000, 160_000, 80, 'me-va-be', 'baby bath'],
    ],
  },
];

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
      realPhotos: number; // số ảnh lấy được từ Pexels (còn lại là ảnh vẽ sẵn)
    }
  | { ok: false; error: 'ALREADY_SEEDED' };

// photo(query): ảnh thật (Pexels) theo từ khoá; không có hoặc lỗi thì dùng ảnh vẽ sẵn.
// makeVideo(i, query): nội dung file video thứ i, hoặc null để bỏ qua video.
export async function seedDemoData(options: {
  photo?: (query: string, shape: 'square' | 'landscape') => Promise<Buffer | null>;
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
  // Ảnh thật không dùng được (lỗi mạng, ảnh hỏng, quá lớn) thì thử lại bằng ảnh vẽ sẵn.
  async function withPhoto<T extends { ok: boolean }>(
    query: string,
    shape: 'square' | 'landscape',
    fallback: () => Promise<Buffer>,
    save: (data: Buffer) => Promise<T>,
  ): Promise<T> {
    const real = await options.photo?.(query, shape);
    if (real) {
      const saved = await save(real);
      if (saved.ok) {
        realPhotos += 1;
        return saved;
      }
    }
    return save(await fallback());
  }

  for (const [i, k] of KIOTS.entries()) {
    const email = `kiot${i + 1}@${DEMO_EMAIL_DOMAIN}`;
    const password = randomBytes(9).toString('base64url');
    if (i === 0) login = { email, password };
    const user = await register({ identifier: email, displayName: k.owner, password });
    if (!user.ok) fail('tài khoản', user);
    const userId = user.ok ? user.userId : '';

    const kiot = await createKiot(userId, {
      name: k.name,
      slug: k.slug,
      description: k.description,
      contactPhone: CONTACT_PHONE,
    });
    if (!kiot.ok) fail(`Kiot ${k.slug}`, kiot);
    const kiotId = kiot.ok ? kiot.kiotId : '';
    await updateKiotAddress(userId, { province: k.province, district: k.district, addressLine: '' });
    await withPhoto(
      k.queries.logo,
      'square',
      () => artwork(k.color, i, 400),
      (data) => setKiotImage(userId, 'logo', data),
    );
    await withPhoto(
      k.queries.cover,
      'landscape',
      () => artwork([k.color[1], k.color[0]], i + 3, 1200),
      (data) => setKiotImage(userId, 'cover', data),
    );
    // Kích hoạt 1 năm không qua thanh toán: không tạo KiotSubscription/PaymentIntent (không đụng sổ tiền).
    await db.$transaction((tx) =>
      extendActiveUntil(tx, kiotId, new Date(now().getTime() + 365 * 86_400_000)),
    );

    const productIds: string[] = [];
    for (const [j, [name, price, compareAtPrice, stock, category, query]] of k.products.entries()) {
      const image = await withPhoto(
        query,
        'square',
        () => artwork(k.color, j, 800),
        (data) => uploadProductImage(userId, data),
      );
      if (!image.ok) fail(`ảnh ${name}`, image);
      const created = await createProduct(userId, {
        name,
        description: `${name}. Sản phẩm mẫu để thử web 9MUA, không bán thật.`,
        price,
        compareAtPrice,
        stock,
        category,
        imageIds: image.ok ? [image.image.id] : [],
      });
      if (!created.ok) fail(`sản phẩm ${name}`, created);
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
