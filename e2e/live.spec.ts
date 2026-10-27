import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// SPEC-live.md (E2E): người phát (camera giả) bắt đầu live → người xem thấy buổi live, số người xem, gửi chat và người
// phát nhận được → ghim sản phẩm → người xem thêm vào giỏ (đơn ghi nguồn buổi live) → người phát kết thúc → người xem
// thấy "Buổi live đã kết thúc". Máy chạy E2E không có MediaMTX nên dùng máy chủ hình giả (TEST_MODE=e2e).
test.beforeAll(async () => {
  // Database E2E dùng lâu ngày: đóng các buổi còn mở từ lần chạy trước để không bị "đủ 2 buổi".
  await e2eDb.liveSession.updateMany({
    where: { status: { in: ['created', 'live'] } },
    data: { status: 'ended', endedAt: new Date(), endReason: 'e2e_cleanup' },
  });
});

// Trình duyệt chỉ mở camera trên trang https; máy test chạy http://9mua.test nên thay camera bằng hình vẽ canvas
// (chỉ trong E2E). RTCPeerConnection vẫn chạy thật.
async function fakeCamera(target: import('@playwright/test').Page) {
  await target.addInitScript(() => {
    if (typeof navigator.mediaDevices?.getUserMedia === 'function') return;
    const getUserMedia = async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 360, height: 640 });
      const ctx = canvas.getContext('2d')!;
      let n = 0;
      setInterval(() => {
        ctx.fillStyle = `hsl(${(n += 7) % 360} 80% 50%)`;
        ctx.fillRect(0, 0, 360, 640);
      }, 100);
      const stream = canvas.captureStream(15);
      const audio = new AudioContext().createMediaStreamDestination();
      audio.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      return stream;
    };
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  });
}

async function syncMedia(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get('http://localhost:3100/api/internal/live/sync', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(res.ok()).toBe(true);
}

test('phát live → xem, chat, ghim sản phẩm, thêm vào giỏ → kết thúc', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await fakeCamera(page);
  const { phone, slug } = await signUpWithKiot(page, 'Kiot Live');
  await activateKiot(slug);
  await createProductViaUi(page, { name: 'Mực một nắng live', price: '320000' });
  // Tài khoản phải tạo ít nhất 3 ngày mới được phát live (SPEC-live.md mục 1).
  const host = await e2eDb.user.findFirstOrThrow({ where: { phone: { endsWith: phone.slice(1) } } });
  await e2eDb.user.update({
    where: { id: host.id },
    data: { createdAt: new Date(Date.now() - 5 * 86_400_000) },
  });

  await page.goto('/live/phat');
  await page.getByTestId('publish-title').fill('Xả kho mực một nắng');
  await page.getByTestId('publish-pick').click();
  await page.getByTestId('publish-pin-search').fill('Mực một nắng live');
  await page.getByTestId('publish-pin-option').first().click();
  await expect(page.getByTestId('publish-pinned')).toContainText('Mực một nắng live');
  await page.getByTestId('publish-start').click();
  await expect(page.getByTestId('publish-status')).toBeVisible();
  // Worker (ở đây: route nội bộ) thấy máy chủ hình đã nhận hình → buổi chuyển "đang live".
  await syncMedia(page.request);
  await expect(page.getByTestId('publish-status')).toHaveText('Đang live', { timeout: 10_000 });
  const live = await e2eDb.liveSession.findFirstOrThrow({ where: { hostUserId: host.id, status: 'live' } });

  // Trang Kiot: avatar viền đỏ + nhãn LIVE.
  const guest = await browser.newPage();
  await guest.goto(`http://${slug}.9mua.test:3100/`);
  await expect(guest.getByTestId('kiot-live-badge')).toHaveAttribute('href', new RegExp(`/live/${live.id}$`));
  await guest.close();

  // Người xem (điện thoại giả lập) vào Live.
  const viewer = await signUpBuyer(browser, 'Người xem live');
  await viewer.goto('/live');
  const player = viewer.getByTestId('live-player').first();
  await expect(player.getByTestId('live-viewers')).toContainText('1 đang xem', { timeout: 15_000 });
  await expect(page.getByTestId('publish-viewers')).toHaveText('1', { timeout: 10_000 });

  await player.getByTestId('live-chat-input').fill('Còn hàng không shop?');
  await player.getByTestId('live-chat-send').click();
  await expect(page.getByTestId('publish-chat')).toContainText('Còn hàng không shop?', { timeout: 10_000 });
  await expect(player.getByTestId('live-chat')).toContainText('Còn hàng không shop?');
  // Chat không cho gửi link.
  await player.getByTestId('live-chat-input').fill('mua rẻ hơn ở shopee.vn/abc');
  await player.getByTestId('live-chat-send').click();
  await expect(viewer.getByTestId('toast')).toContainText('Không gửi link trong chat.');

  await player.getByTestId('live-heart').click();
  await expect(player.getByTestId('live-pinned')).toContainText('Mực một nắng live');
  await player.getByTestId('live-add-cart').click();
  await expect(viewer.getByTestId('toast')).toContainText('Đã thêm vào giỏ');
  const buyer = await e2eDb.cartItem.findFirstOrThrow({ where: { sourceLiveId: live.id } });
  expect(buyer.qty).toBe(1);

  page.on('dialog', (d) => void d.accept());
  await page.getByTestId('publish-end').click();
  await expect(page.getByTestId('publish-summary')).toBeVisible();
  await expect(player.getByTestId('live-ended')).toContainText('Buổi live đã kết thúc', { timeout: 10_000 });
  // Link chia sẻ sau khi kết thúc.
  await viewer.goto(`/live/${live.id}`);
  await expect(viewer.getByTestId('live-ended')).toContainText('Buổi live đã kết thúc');
});

test('tài khoản dưới 3 ngày không phát được live; chưa có ai live thì hiện nút Phát live', async ({
  browser,
}) => {
  const fresh = await signUpBuyer(browser, 'Tài khoản mới');
  await fakeCamera(fresh);
  await fresh.goto('/live');
  await expect(fresh.getByTestId('go-live')).toHaveAttribute('href', '/live/phat');
  await fresh.goto('/live/phat');
  await fresh.getByTestId('publish-title').fill('Thử live');
  await fresh.getByTestId('publish-start').click();
  await expect(fresh.getByTestId('publish-error')).toHaveText(
    'Tài khoản cần tạo ít nhất 3 ngày mới được phát live.',
  );
});
