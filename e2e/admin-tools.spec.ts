import { expect, test, type Browser } from '@playwright/test';
import { signUpWithPassword } from './helpers/auth';
import { promoteToAdmin, setUpAdminTotp, totpCode } from './helpers/admin';
import { activateKiot, e2eDb } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

const PASSWORD = 'mat-khau-ceo-e2e-123';

async function newCeo(browser: Browser) {
  const phone = `07${String(Date.now()).slice(-8)}`;
  const page = await browser.newPage();
  await signUpWithPassword(page, { identifier: phone, name: 'CEO công cụ', password: PASSWORD, next: '/' });
  promoteToAdmin(phone);
  const secret = await setUpAdminTotp(page);
  page.on('dialog', (d) => d.accept());
  return { phone, page, secret };
}

async function relogin(page: import('@playwright/test').Page, phone: string) {
  await page.goto('/tai-khoan');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goto('/dang-nhap?next=/admin');
  await page.fill('#identifier', phone);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test('nhớ thiết bị 30 ngày: lần sau không hỏi mã; "Quên mọi thiết bị" thì hỏi lại', async ({ browser }) => {
  const { phone, secret } = await newCeo(browser);
  const device = await browser.newPage();
  device.on('dialog', (d) => d.accept());
  await device.goto('/dang-nhap?next=/admin');
  await device.fill('#identifier', phone);
  await device.fill('#password', PASSWORD);
  await device.getByRole('button', { name: 'Đăng nhập' }).click();
  await device.waitForURL((u) => u.pathname === '/admin/xac-thuc');
  await expect(device.getByLabel('Nhớ thiết bị này 30 ngày')).toBeChecked();
  await device.fill('#totp-code', await totpCode(secret, 30));
  await device.getByRole('button', { name: 'Xác nhận' }).click();
  await device.waitForURL((u) => u.pathname === '/admin');

  await relogin(device, phone);
  await device.waitForURL((u) => u.pathname === '/admin');
  await expect(device.getByTestId('todo-box')).toBeVisible();

  await device.goto('/admin/cai-dat');
  await expect(device.getByTestId('trusted-devices').locator('li')).toHaveCount(1);
  await device.getByRole('button', { name: 'Quên mọi thiết bị đã nhớ' }).click();
  await expect(device.getByText(/Đã quên 1 thiết bị/)).toBeVisible();
  await relogin(device, phone);
  await device.waitForURL((u) => u.pathname === '/admin/xac-thuc');
});

test('CEO ghim video lên đầu feed và Kiot lên đầu danh bạ; sửa slogan có hiệu lực ngay', async ({
  browser,
}) => {
  test.setTimeout(90_000); // tạo CEO + Kiot + sản phẩm + nhiều bước admin
  const { page: ceo } = await newCeo(browser);
  await e2eDb.pin.deleteMany({}); // ghim / slogan sót lại từ lần chạy hỏng trước
  await e2eDb.setting.deleteMany({ where: { key: 'slogans_json' } });

  // Video điểm thấp nhất vẫn lên đầu khi được ghim.
  const author = await e2eDb.user.findFirstOrThrow({ where: { role: 'user' } });
  const video = await e2eDb.video.create({
    data: {
      authorId: author.id,
      caption: `Video ghim ${Date.now()}`,
      status: 'ready',
      fileUrl: `/uploads/ghim-${Date.now()}.mp4`,
      readyAt: new Date(),
      durationSec: 10,
      score: 0,
    },
  });
  await ceo.goto('/admin/ghim');
  await ceo.getByLabel('Mã video hoặc link 9mua.com/v/…').fill(`https://9mua.test/v/${video.id}`);
  await ceo.getByRole('button', { name: 'Ghim', exact: true }).first().click();
  await ceo.waitForURL((u) => u.searchParams.has('xong'));
  await expect(ceo.getByTestId('pins-video')).toContainText(video.caption);

  const seller = await browser.newPage();
  const { slug } = await signUpWithKiot(seller, 'Kiot Được Ghim');
  await createProductViaUi(seller, { name: 'Hàng Kiot ghim', price: '15000' });
  await activateKiot(slug);
  await ceo.getByLabel('Tên miền Kiot').fill(`${slug}.9mua.test`);
  await ceo.getByRole('button', { name: 'Ghim', exact: true }).nth(1).click();
  await ceo.waitForURL((u) => u.searchParams.get('xong') === 'Đã ghim Kiot.');
  await expect(ceo.getByTestId('pins-kiot')).toContainText('Kiot Được Ghim');

  const guest = await browser.newPage();
  await guest.goto('/');
  await expect(guest.getByTestId('feed-item').first().locator('video')).toHaveAttribute(
    'src',
    video.fileUrl!,
  );
  await guest.goto('/cho/kiot');
  await expect(guest.getByTestId('kiot-cards').locator('li').first()).toContainText('Kiot Được Ghim');

  // Dọn ghim để không ảnh hưởng test khác.
  for (const name of ['pins-video', 'pins-kiot']) {
    await ceo.getByTestId(name).getByRole('button', { name: 'Bỏ ghim' }).first().click();
    await expect(ceo.getByText('Đã bỏ ghim.')).toBeVisible();
  }

  // Slogan tiếng Hàn của Chợ (không test nào khác dùng tiếng Hàn).
  await ceo.goto('/admin/noi-dung');
  await ceo.locator('summary', { hasText: /^Chợ$/ }).click();
  await ceo.locator('input[name="slogan.explore.ko"]').fill('CEO가 바꾼 슬로건');
  await ceo.getByRole('button', { name: 'Lưu' }).click();
  await ceo.waitForURL((u) => u.searchParams.has('xong') || u.searchParams.has('loi'));
  await expect(ceo.getByText(/Đã lưu/)).toBeVisible();
  const ko = await browser.newPage({ locale: 'ko-KR' });
  await ko.goto('/cho');
  await expect(ko.getByTestId('page-slogan')).toHaveText('CEO가 바꾼 슬로건');
  await ceo.locator('summary', { hasText: /^Chợ$/ }).click(); // trang tải lại, mục đóng lại
  await ceo.locator('input[name="slogan.explore.ko"]').fill('');
  await ceo.getByRole('button', { name: 'Lưu' }).click();
  await expect(ceo.getByText(/Đã lưu/)).toBeVisible();
});
