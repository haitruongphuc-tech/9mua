import { expect, test } from '@playwright/test';

// T47: khung giao diện V4 — thanh dưới 5 nút trên mọi màn hình, header logo + slogan + tìm + giỏ.
test('thanh dưới: Video · Chợ · Live · Kiot · Tôi, nút đang ở sáng lên; slogan đổi theo trang', async ({
  page,
  isMobile,
}) => {
  await page.goto('/cho');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveText(['Video', 'Chợ', 'Live', 'Kiot', 'Tôi']);
  await expect(nav.getByRole('link', { name: 'Chợ' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('page-slogan')).toHaveText('Kiot nào cũng là showroom - 9MUA kết nối');

  const go = (name: string) =>
    isMobile ? nav.getByRole('link', { name }).tap() : nav.getByRole('link', { name }).click();
  await go('Kiot');
  await page.waitForURL((u) => u.pathname === '/cho/kiot');
  await expect(nav.getByRole('link', { name: 'Kiot' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Chợ' })).not.toHaveAttribute('aria-current', 'page');

  await go('Live');
  await page.waitForURL((u) => u.pathname === '/live');
  await expect(page.getByTestId('page-slogan')).toHaveText('Nhìn thật - Mua thật - Người thật việc thật');

  // Chưa đăng nhập: nút Tôi dẫn tới đăng nhập.
  await expect(nav.getByTestId('user-menu')).toHaveAccessibleName('Tôi (đăng nhập)');
  await expect(nav.getByTestId('user-menu')).toHaveAttribute('href', '/dang-nhap?next=%2Ftai-khoan');

  // Nội dung cuối trang không bị thanh dưới che.
  await page.goto('/cho');
  const footer = page.getByRole('contentinfo');
  await footer.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const bar = (await nav.boundingBox())!;
  await expect
    .poll(async () => {
      const f = (await footer.boundingBox())!;
      return f.y + f.height;
    })
    .toBeLessThanOrEqual(bar.y + 1);
  // Không có thanh cuộn ngang (trang không rộng hơn màn hình).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('header V4: logo tròn về trang chủ; điện thoại có nút tìm, máy tính có ô tìm', async ({
  page,
  isMobile,
}) => {
  await page.goto('/cho/kiot');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Giỏ hàng (0 món)' })).toBeVisible();
  if (isMobile) {
    await header.getByRole('link', { name: 'Tìm kiếm' }).tap();
    await page.waitForURL((u) => u.pathname === '/cho');
    const search = page.getByRole('searchbox', { name: 'Tìm sản phẩm' });
    await search.fill('mật ong');
    await search.press('Enter');
  } else {
    await expect(header.getByRole('link', { name: 'Tìm kiếm' })).toBeHidden();
    const search = header.getByRole('searchbox', { name: 'Tìm trên Chợ 9MUA' });
    await search.fill('mật ong');
    await search.press('Enter');
  }
  await page.waitForURL((u) => u.pathname === '/cho' && u.searchParams.get('q') === 'mật ong');
  await header.getByRole('link', { name: '9MUA - Trang chủ' }).click();
  await page.waitForURL((u) => u.pathname === '/');
});
