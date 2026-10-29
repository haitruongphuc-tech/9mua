import { expect, type Page } from '@playwright/test';
import { signUpByEmail, signUpWithPassword, uniqueEmail } from './auth';

let seq = 0;

// Đăng ký tài khoản mới và tạo Kiot nháp; trả về slug của Kiot.
// password: tạo tài khoản có mật khẩu (tài khoản cũ) cho bài cần nhập mật khẩu, vd. tài khoản nhận tiền.
export async function signUpWithKiot(
  page: Page,
  name = 'Kiot E2E',
  opts: { password?: string } = {},
): Promise<{ email: string; slug: string }> {
  seq += 1;
  const stamp = `${String(Date.now()).slice(-7)}${seq}`;
  let email: string;
  if (opts.password) {
    email = uniqueEmail('kiot');
    await signUpWithPassword(page, {
      identifier: email,
      name: 'Chủ Kiot',
      password: opts.password,
      next: '/kiot-cua-toi/tao',
    });
  } else email = await signUpByEmail(page, { name: 'Chủ Kiot', next: '/kiot-cua-toi/tao' });
  const slug = `e2e-${stamp}`;
  await page.fill('#kiot-name', `${name} ${stamp}`);
  await page.fill('#kiot-slug', slug);
  await page.fill('#kiot-phone', '0979393916');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi');
  await expect(page.getByTestId('kiot-status')).toBeVisible();
  return { email, slug };
}
