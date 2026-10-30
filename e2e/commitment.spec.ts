import { expect, test } from '@playwright/test';
import { normalizeIdentifier } from '../src/modules/identity/identifier';
import { hashPassword } from '../src/modules/identity/password';
import { e2eDb } from './helpers/db';
import { loginWithPassword } from './helpers/auth';

// Cam kết nội dung (SPEC-identity.md V5.6): tài khoản cũ chưa đồng ý thì được hỏi ở lần đầu đăng video.
test('tài khoản cũ chưa cam kết: vào Đăng video thì hiện bảng M5, tick đủ 4 ô mới đi tiếp', async ({
  page,
}) => {
  const email = `camket-${Date.now()}@e2e.9mua.test`;
  const id = normalizeIdentifier(email)!;
  // Tạo thẳng trong DB, không qua helper (helper tự đồng ý cam kết).
  await e2eDb.user.create({
    data: { ...id.where, displayName: 'Chưa Cam Kết', passwordHash: await hashPassword('mat-khau-ck-123') },
  });
  await loginWithPassword(page, email, 'mat-khau-ck-123', '/video/dang');
  await page.waitForURL(
    (u) => u.pathname === '/cam-ket/dong-y' && u.searchParams.get('next') === '/video/dang',
  );
  const form = page.getByTestId('commitment-form');
  await expect(form.getByRole('checkbox')).toHaveCount(4);
  await expect(form).toContainText('Tôi không bán hàng giả');
  // Thiếu 1 ô thì trình duyệt không cho gửi.
  const boxes = await form.getByRole('checkbox').all();
  for (const box of boxes.slice(0, 3)) await box.check();
  await page.getByTestId('commitment-accept').click();
  await expect(page).toHaveURL(/\/cam-ket\/dong-y/);
  await boxes[3]!.check();
  await page.getByTestId('commitment-accept').click();
  await page.waitForURL((u) => u.pathname === '/video/dang');
  const user = await e2eDb.user.findUniqueOrThrow({ where: { email } });
  expect(await e2eDb.commitment.count({ where: { userId: user.id } })).toBe(1);

  // Trang công khai /cam-ket.
  await page.goto('/cam-ket');
  await expect(page.getByTestId('commitment-lines').getByRole('listitem')).toHaveCount(4);
});
