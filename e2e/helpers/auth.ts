import { expect, type Browser, type Page } from '@playwright/test';
import { normalizeIdentifier } from '../../src/modules/identity/identifier';
import { hashPassword } from '../../src/modules/identity/password';
import { e2eDb } from './db';
import { waitForMail } from './mail';

let seq = 0;

// Email ngẫu nhiên để chạy lặp lại trên cùng database.
export const uniqueEmail = (prefix = 'e2e') => `${prefix}-${Date.now()}-${(seq += 1)}@e2e.9mua.test`;

// Mã 6 số trong thư mới nhất gửi tới email. notCode: chờ tới khi có thư mới với mã khác (lần xin mã thứ 2).
export async function codeFromMail(email: string, notCode?: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(async () => {
      code = /\b(\d{6})\b/.exec((await waitForMail(email)).text)?.[1];
      return code && code !== notCode;
    })
    .toBe(true);
  return code!;
}

// Đăng ký bằng mã email (SPEC-identity.md bổ sung 29/10) trên trang /dang-ky.
export async function signUpByEmail(
  page: Page,
  { name, next = '/', email = uniqueEmail() }: { name: string; next?: string; email?: string },
): Promise<string> {
  await page.goto(`/dang-ky?next=${encodeURIComponent(next)}`);
  await page.getByTestId('otp-name').fill(name);
  await page.getByTestId('otp-email').fill(email);
  await page.getByTestId('otp-send').click();
  await expect(page.getByTestId('otp-sent')).toBeVisible();
  await page.getByTestId('otp-code').fill(await codeFromMail(email));
  await page.getByTestId('otp-verify').click();
  const path = next.split('?')[0];
  await page.waitForURL((u) => u.pathname === path);
  return email;
}

export async function newBuyerPage(browser: Browser, name: string): Promise<Page> {
  const page = await browser.newPage();
  await signUpByEmail(page, { name });
  return page;
}

// Tài khoản cũ (đăng ký trước 29/10 bằng SĐT/email + mật khẩu) hoặc tài khoản sắp nâng admin: tạo sẵn trong DB.
export async function createPasswordUser(identifier: string, name: string, password: string) {
  const id = normalizeIdentifier(identifier);
  if (!id) throw new Error(`SĐT/email không hợp lệ: ${identifier}`);
  return e2eDb.user.create({
    data: { ...id.where, displayName: name, passwordHash: await hashPassword(password) },
  });
}

export async function loginWithPassword(page: Page, identifier: string, password: string, next = '/') {
  await page.goto(`/dang-nhap?next=${encodeURIComponent(next)}`);
  await page.fill('#identifier', identifier);
  await page.fill('#password', password);
  await page.getByTestId('login-submit').click();
}

// Tạo tài khoản mật khẩu rồi đăng nhập (thay cho form đăng ký SĐT đã bỏ).
export async function signUpWithPassword(
  page: Page,
  {
    identifier,
    name,
    password,
    next = '/',
  }: { identifier: string; name: string; password: string; next?: string },
) {
  await createPasswordUser(identifier, name, password);
  await loginWithPassword(page, identifier, password, next);
  const path = next.split('?')[0];
  await page.waitForURL((u) => u.pathname === path);
}
