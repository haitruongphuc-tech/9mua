import { register } from '@/modules/identity/register';
import sharp from 'sharp';
import { createKiot } from '@/modules/kiot/kiot';
import { db } from '@/lib/db';
let seq = 0;

// Tạo người dùng thử với SĐT duy nhất trong mỗi test.
export async function createUser(overrides: { displayName?: string; password?: string } = {}) {
  seq += 1;
  const phone = `09${String(10_000_000 + seq).slice(-8)}`;
  const result = await register({
    identifier: phone,
    displayName: overrides.displayName ?? `Người dùng ${seq}`,
    password: overrides.password ?? 'matkhau-9mua',
  });
  if (!result.ok) throw new Error(`createUser thất bại: ${JSON.stringify(result)}`);
  // Người dùng thử đã đồng ý cam kết nội dung bản 1 (SPEC-identity.md V5.6), như người đăng ký qua form.
  await db.commitment.create({ data: { userId: result.userId, version: 1 } });
  return { id: result.userId, phone, password: overrides.password ?? 'matkhau-9mua' };
}

let kiotSeq = 0;

export async function createSeller(options: { active?: boolean } = {}) {
  const user = await createUser();
  kiotSeq += 1;
  const slug = `kiot-thu-${kiotSeq}-${Date.now() % 100000}`;
  const result = await createKiot(user.id, {
    name: `Kiot thử ${kiotSeq}`,
    slug,
    contactPhone: '0979393916',
    description: '',
  });
  if (!result.ok) throw new Error(`createSeller thất bại: ${JSON.stringify(result)}`);
  if (options.active) {
    await db.kiot.update({
      where: { id: result.kiotId },
      data: { activeUntil: new Date(Date.now() + 365 * 86_400_000) },
    });
  }
  return { user, kiotId: result.kiotId, slug };
}

export function sampleImage(color = '#fc6f15', width = 800, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
}

export async function createProduct(
  kiotId: string,
  data: { name?: string; price?: number; stock?: number } = {},
) {
  return db.product.create({
    data: {
      kiotId,
      name: data.name ?? 'Thanh long ruột đỏ',
      price: data.price ?? 45_000,
      stock: data.stock ?? 10,
      category: 'nong-san',
      images: {
        create: { kiotId, url: '/uploads/p.webp', thumbUrl: '/uploads/p-400.webp', width: 1, height: 1 },
      },
    },
  });
}

export const sampleAddress = {
  name: 'Trần Thị Mua',
  phone: '0912345678',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận Tân Phú',
  ward: 'Phường Phú Thọ Hòa',
  line: '115 Nguyễn Hậu',
};

// Đơn đã thanh toán sẵn để test các bước sau (dùng thẳng các hàm của module orders/payments).
export async function createPaidOrder(options: { qty?: number; price?: number; stock?: number } = {}) {
  const { addToCart } = await import('@/modules/orders/cart');
  const { placeOrder } = await import('@/modules/orders/place-order');
  const { getPayment } = await import('@/server/payments');
  const { simulatePaid } = await import('./payments');
  const seller = await createSeller({ active: true });
  const buyer = await createUser();
  const product = await createProduct(seller.kiotId, {
    price: options.price ?? 100_000,
    stock: options.stock ?? 10,
  });
  await addToCart(buyer.id, product.id, options.qty ?? 1);
  const r = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
  if (!r.ok) throw new Error(`createPaidOrder: ${JSON.stringify(r)}`);
  await simulatePaid((await getPayment(r.intentId))!.orderCode);
  const order = await db.order.findFirstOrThrow({ where: { checkoutId: r.checkoutId } });
  return { seller, buyer, product, order, checkoutId: r.checkoutId };
}
