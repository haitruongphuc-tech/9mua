import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { newBuyerPage } from './helpers/auth';
import { e2eDb } from './helpers/db';

// Trang cá nhân đầy đủ (SPEC-social.md bổ sung 30/10, A2): ảnh đại diện, ảnh bìa, giới thiệu, danh sách theo dõi.
test('sửa hồ sơ → ảnh trên trang cá nhân, header và video; danh sách người theo dõi', async ({ browser }) => {
  // Có tải và chuyển mã video: khi máy test bận có lúc quá 30 giây (như e2e/creator.spec.ts).
  test.setTimeout(60_000);
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Chị Hoa ${stamp}`);
  const me = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Chị Hoa ${stamp}` } });

  // Trang Tôi → Sửa hồ sơ.
  await page.goto('/tai-khoan');
  await page.getByTestId('me-edit-profile').click();
  await page.waitForURL((u) => u.pathname === '/tai-khoan/ho-so');

  // File giả đuôi .jpg bị từ chối; ảnh thật thì lưu ngay, header đổi sang ảnh.
  await page.setInputFiles('[data-testid=profile-avatar-input]', 'e2e/fixtures/khong-phai-anh.jpg');
  await expect(page.getByTestId('profile-image-error')).toBeVisible();
  await page.setInputFiles('[data-testid=profile-avatar-input]', 'e2e/fixtures/anh-cam.jpg');
  await expect(page.getByTestId('profile-avatar-preview')).toHaveAttribute('data-url', /^\/uploads\/users\//);
  await expect(page.getByTestId('user-menu').locator('img')).toHaveAttribute('src', /\/uploads\/users\//);
  await page.setInputFiles('[data-testid=profile-cover-input]', 'e2e/fixtures/anh-den.jpg');
  await expect(page.getByTestId('profile-cover-preview')).toBeVisible();

  // Giới thiệu: có link thì báo lỗi; hợp lệ thì lưu.
  await page.fill('#profile-bio', 'Mua tại shopee.vn/abc');
  await page.locator('#thong-tin button[type=submit]').click();
  await expect(page.getByTestId('profile-error')).toHaveText('Giới thiệu không được chứa link.');
  await page.fill('#profile-bio', 'Bán thanh long Bình Thuận\nGiao toàn quốc');
  await page.locator('#thong-tin button[type=submit]').click();
  await expect(page.getByTestId('profile-ok')).toHaveText('Đã lưu hồ sơ.');

  // Trang cá nhân công khai: bìa, ảnh, giới thiệu; chủ trang thấy nút Sửa hồ sơ.
  await page.goto(`/creator/${me.id}`);
  await expect(page.getByTestId('creator-cover')).toBeVisible();
  await expect(page.getByTestId('creator-avatar')).toHaveAttribute('data-url', /^\/uploads\/users\//);
  await expect(page.getByTestId('creator-bio')).toHaveText('Bán thanh long Bình Thuận\nGiao toàn quốc');
  await expect(page.getByRole('link', { name: 'Sửa hồ sơ' })).toBeVisible();

  // Người khác theo dõi → bấm số Người theo dõi thấy tên + ảnh của người đó.
  const fan = await newBuyerPage(browser, `Fan ${stamp}`);
  await fan.goto(`/creator/${me.id}`);
  await expect(fan.getByRole('link', { name: 'Sửa hồ sơ' })).toHaveCount(0);
  await fan.getByTestId('profile-follow').click();
  await expect(fan.getByTestId('stat-followers')).toHaveText('1');
  await fan.reload();
  await fan.getByTestId('stat-link-followers').click();
  await fan.waitForURL((u) => u.pathname === `/creator/${me.id}/theo-doi`);
  await expect(fan.getByTestId('follow-person')).toContainText(`Fan ${stamp}`);
  await fan.getByRole('link', { name: 'Đang follow' }).click();
  await expect(fan.getByText('Chưa theo dõi ai.')).toBeVisible();

  // Đăng video → ảnh đại diện hiện trên video ở feed.
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/iphone-hevc.mov');
  await page.getByTestId('video-caption').fill(`Video hồ sơ ${stamp}`);
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi');
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Video hồ sơ ${stamp}` } });
  await fan.goto(`/v/${video.id}`);
  await expect(
    fan.getByTestId('feed-item').first().getByTestId('feed-author-avatar').locator('img'),
  ).toHaveAttribute('src', /\/uploads\/users\//);

  // @tên (SPEC-identity.md V5.1): link cũ /creator/<id> chuyển sang /@<tên>; đổi @tên trong Cài đặt, tên cũ chuyển hướng.
  await page.goto(`/creator/${me.id}`);
  await page.waitForURL((u) => u.pathname.startsWith('/@'));
  const oldHandle = new URL(page.url()).pathname.slice(2);
  await expect(page.getByTestId('creator-handle')).toHaveText(`@${oldHandle}`);
  const newHandle = `hoa.${stamp}`;
  await page.goto('/tai-khoan/cai-dat');
  await page.fill('#handle', newHandle);
  await page.locator('#ten-nguoi-dung button[type=submit]').click();
  await expect(page.getByTestId('handle-ok')).toHaveText('Đã đổi tên người dùng.');
  await page.goto(`/@${oldHandle}`);
  await page.waitForURL((u) => u.pathname === `/@${newHandle}`);
  await expect(page.getByTestId('creator-handle')).toHaveText(`@${newHandle}`);
});
