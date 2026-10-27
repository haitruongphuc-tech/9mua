import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// Trang Kiot V4 + Social Connect (SPEC-kiot.md bổ sung 27/10).
test('trang Kiot V4: link mạng xã hội, Follow chủ Kiot, Tim, tab Video/Sản phẩm/Live, + Giỏ, chia sẻ', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const { slug } = await signUpWithKiot(page, 'Vườn Cà Phê');
  await createProductViaUi(page, { name: 'Cà phê Robusta 500g', price: '120000' });
  await activateKiot(slug);

  // Chủ Kiot gắn link: link sai mạng bị báo đỏ; sửa xong thì lưu được.
  await page.goto('/ket-noi');
  await page.getByLabel('Link trang TikTok của bạn').fill('tiktok.com/@vuoncaphe');
  await page.getByLabel('Link trang Facebook của bạn').fill('youtube.com/@khongphai');
  await page.getByRole('button', { name: 'Lưu link' }).click();
  await expect(page.getByTestId('connect-status')).toHaveText(
    'Có link không đúng mạng xã hội, vui lòng sửa ô màu đỏ.',
  );
  await expect(page.getByText('Link này không phải trang Facebook.')).toBeVisible();
  await page.getByLabel('Link trang Facebook của bạn').fill('');
  await page.getByRole('button', { name: 'Lưu link' }).click();
  await expect(page.getByTestId('connect-status')).toHaveText('Đã lưu link mạng xã hội.');
  await page.reload();
  await expect(page.getByTestId('connect-count')).toHaveText('1/6');

  const kiotUrl = `http://${slug}.9mua.test:${new URL(page.url()).port}`;
  // Chủ Kiot thấy "Quản lý Kiot" thay cho Follow.
  await page.goto(kiotUrl);
  await expect(page.getByRole('link', { name: 'Quản lý Kiot' })).toBeVisible();
  await expect(page.getByTestId('profile-follow')).toHaveCount(0);

  const fan = await signUpBuyer(browser, 'Khách Ghé Kiot');
  await fan.goto(kiotUrl);
  await expect(fan.getByTestId('kiot-handle')).toHaveText(`@${slug} • Chủ Kiot`);
  await expect(fan.getByTestId('stat-followers')).toHaveText('0');
  await expect(fan.getByTestId('stat-products')).toHaveText('1');
  await expect(fan.getByTestId('stat-sold')).toHaveText('0');
  await expect(fan.getByTestId('social-links').getByRole('link', { name: 'TikTok' })).toHaveAttribute(
    'href',
    'https://tiktok.com/@vuoncaphe',
  );

  await fan.getByTestId('profile-follow').click();
  await expect(fan.getByTestId('profile-follow')).toHaveText('Đang follow');
  await expect(fan.getByTestId('stat-followers')).toHaveText('1');
  await fan.getByTestId('profile-heart').click();
  await expect(fan.getByTestId('stat-hearts')).toHaveText('1');
  await expect(fan.getByTestId('profile-heart')).toHaveAttribute('aria-pressed', 'true');

  // Mặc định tab Sản phẩm: thẻ trắng có "+ Giỏ".
  await fan.getByRole('button', { name: 'Thêm Cà phê Robusta 500g vào giỏ' }).click();
  await expect(fan.getByTestId('toast')).toHaveText('Đã thêm vào giỏ hàng.');

  const tabs = fan.getByRole('navigation', { name: 'Nội dung của Kiot' });
  await tabs.getByRole('link', { name: 'Video' }).click();
  await expect(fan.getByText('Chủ Kiot chưa đăng video nào.')).toBeVisible();
  await tabs.getByRole('link', { name: 'Live' }).click();
  await expect(fan.getByTestId('kiot-live-tab')).toContainText('Chủ Kiot chưa live.');

  await fan.getByRole('button', { name: 'Chia sẻ' }).click();
  await expect(fan.getByTestId('share-sheet')).toContainText('Chia sẻ Kiot');
  await expect(fan.getByTestId('share-url')).toHaveText(`http://${slug}.9mua.test:3100`);

  // Sau khi tải lại vẫn giữ trạng thái thật từ máy chủ.
  await fan.goto(kiotUrl);
  await expect(fan.getByTestId('profile-follow')).toHaveText('Đang follow');
  const owner = await e2eDb.kiot.findUniqueOrThrow({ where: { slug }, select: { ownerId: true } });
  expect(await e2eDb.follow.count({ where: { followeeId: owner.ownerId } })).toBe(1);

  // Trang creator của chủ Kiot cũng có link mạng xã hội và số Followers.
  await fan.goto(`/creator/${owner.ownerId}`);
  await expect(fan.getByTestId('stat-followers')).toHaveText('1');
  await expect(fan.getByTestId('social-links').getByRole('link', { name: 'TikTok' })).toBeVisible();
  await fan.close();
});
