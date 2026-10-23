import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';
import { MAIL_DIR } from '../../playwright.config';

type Mail = { to: string; subject: string; text: string };

// Chờ thư mới nhất gửi tới địa chỉ `to` (server E2E ghi thư ra MAIL_DIR).
export async function waitForMail(to: string): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(async () => {
      const files = (await readdir(MAIL_DIR).catch(() => [])).sort().reverse();
      for (const f of files) {
        const mail = JSON.parse(await readFile(path.join(MAIL_DIR, f), 'utf8')) as Mail;
        if (mail.to === to) return (found = mail);
      }
      return undefined;
    })
    .toBeTruthy();
  return found!;
}
