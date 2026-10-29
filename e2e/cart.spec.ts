import { expect, test } from '@playwright/test';
import { codeFromMail, uniqueEmail } from './helpers/auth';
import { activateKiot } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('khách chưa đăng nhập bấm Thêm vào giỏ → đăng ký → món tự vào giỏ; giỏ nhóm theo Kiot, phí ship', async ({
  page,
  browser,
}) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Giỏ Hàng');
  await createProductViaUi(page, { name: 'Muối ớt Tây Ninh', price: '25000', stock: '3' });
  await page.goto('/kiot-cua-toi/cai-dat');
  await page.fill('#ship-fee', '20.000');
  await page.fill('#ship-free', '100000');
  await page.locator('#phi-ship button[type=submit]').click();
  await expect(page.getByTestId('shipping-ok')).toBeVisible();
  await activateKiot(slug);

  const buyer = await browser.newPage();
  const port = new URL(page.url()).port;
  await buyer.goto(`http://${slug}.9mua.test:${port}`);
  await buyer.getByTestId('product-grid').getByRole('link').first().click();
  await buyer.fill('input[name=qty]', '2');
  await buyer.getByRole('button', { name: /Thêm vào giỏ/ }).click();

  // Chưa đăng nhập: chuyển sang tên miền chính để đăng nhập/đăng ký rồi tự thêm món.
  await buyer.waitForURL(/9mua\.test:\d+\/dang-nhap\?next=/);
  await buyer.getByRole('link', { name: 'Tạo tài khoản' }).click();
  // Chờ sang hẳn trang đăng ký (đăng ký bằng mã email).
  await buyer.waitForURL((u) => u.pathname === '/dang-ky');
  const email = uniqueEmail('mua');
  await buyer.getByTestId('otp-email').fill(email);
  await buyer.getByTestId('otp-send').click();
  await buyer.getByTestId('otp-code').fill(await codeFromMail(email));
  await buyer.getByTestId('otp-verify').click();
  await buyer.waitForURL((u) => u.pathname === '/gio-hang');

  await expect(buyer.getByTestId('cart-line')).toHaveCount(1);
  await expect(buyer.getByTestId('cart-total')).toHaveText('70.000đ'); // 2×25.000 + ship 20.000
  await expect(buyer.getByTestId('cart-count')).toHaveText('1');

  // Tăng lên 4 (vượt tồn 3) → báo lỗi, không cho đặt.
  await buyer.fill('input[name=qty]', '4');
  await buyer.getByRole('button', { name: 'Cập nhật' }).click();
  await expect(buyer.locator('input[name=qty]')).toHaveValue('2');

  // Chủ Kiot không mua được hàng của mình.
  await page.goto(`http://${slug}.9mua.test:${port}`);
  await page.getByTestId('product-grid').getByRole('link').first().click();
  await page.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  await expect(page.getByTestId('cart-message')).toHaveText('Bạn không thể mua sản phẩm của Kiot mình.');
  await buyer.close();
});
