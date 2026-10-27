import { expect, test } from '@playwright/test';

// T39: thanh điều hướng 5 nút trên điện thoại, header có ô tìm kiếm, logo tròn dẫn về trang chủ.
test('điện thoại: thanh dưới 5 nút, nút đang ở sáng lên; ô tìm kiếm mở Chợ', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'chỉ điện thoại');
  await page.goto('/cho');
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveText(['Trang chủ', 'Chợ', 'Đăng video', 'Video', 'Tôi']);
  await expect(nav.getByRole('link', { name: 'Chợ' })).toHaveAttribute('aria-current', 'page');
  // Link chữ ở thanh trên chỉ có trên máy tính.
  await expect(page.getByRole('banner').getByRole('link', { name: 'Video', exact: true })).toBeHidden();

  await nav.getByRole('link', { name: 'Trang chủ' }).tap();
  await page.waitForURL((u) => u.pathname === '/');
  await expect(nav.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page');

  const search = page.getByRole('searchbox', { name: 'Tìm trên Chợ 9MUA' });
  await search.fill('mật ong');
  await search.press('Enter');
  await page.waitForURL((u) => u.pathname === '/cho' && u.searchParams.get('q') === 'mật ong');

  // Nội dung cuối trang không bị thanh dưới che.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = await page.getByRole('contentinfo').boundingBox();
  const bar = await nav.boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(bar!.y + 1);
});

test('máy tính: không có thanh dưới, thanh trên có Chợ/Video/Bán hàng và logo về trang chủ', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'chỉ máy tính');
  await page.goto('/cho');
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeHidden();
  const header = page.getByRole('banner');
  for (const name of ['Chợ', 'Video', 'Bán hàng'])
    await expect(header.getByRole('link', { name, exact: true })).toBeVisible();
  await header.getByRole('link', { name: '9MUA - Trang chủ' }).click();
  await page.waitForURL((u) => u.pathname === '/');
});
