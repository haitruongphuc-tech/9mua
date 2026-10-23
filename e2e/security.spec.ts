import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('header bảo mật + CSP: không có vi phạm trên các trang chính, script lạ bị chặn', async ({
  page,
  browser,
}) => {
  const { slug } = await signUpWithKiot(page, 'Kiot CSP');
  await activateKiot(slug);
  await createProductViaUi(page, { name: 'Bánh tráng CSP', price: '30000' });

  const visitor = await browser.newPage();
  const violations: string[] = [];
  visitor.on('console', (m) => {
    if (/Content Security Policy|Refused to/.test(m.text())) violations.push(`${visitor.url()}: ${m.text()}`);
  });
  for (const url of [
    '/',
    '/cho',
    '/cho/nong-san',
    '/video',
    '/dang-nhap',
    '/quen-mat-khau',
    `http://${slug}.9mua.test:3100/`,
  ]) {
    const res = await visitor.goto(url);
    const h = res!.headers();
    expect(h['content-security-policy'], url).toContain("'strict-dynamic'");
    expect(h['x-frame-options'], url).toBe('DENY');
    expect(h['x-content-type-options'], url).toBe('nosniff');
    expect(h['x-powered-by'], url).toBeUndefined();
    await visitor.waitForLoadState('load');
    await visitor.waitForTimeout(300);
  }
  // Trang sản phẩm trên tên miền phụ vẫn chạy JS (nút thêm giỏ hoạt động).
  await visitor.getByTestId('product-grid').getByRole('link').first().click();
  await expect(visitor.getByRole('button', { name: /Thêm vào giỏ/ })).toBeEnabled();
  expect(violations).toEqual([]);

  // HTML bị chèn vào trang (kiểu XSS) với trình xử lý sự kiện inline → trình duyệt chặn, không chạy.
  const blocked = await visitor.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        document.body.insertAdjacentHTML('beforeend', '<img src="/khong-co.png" onerror="window.__xss = 1">');
        setTimeout(() => resolve(!(window as unknown as { __xss?: number }).__xss), 800);
      }),
  );
  expect(blocked).toBe(true);
});
