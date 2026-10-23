import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

export type Mail = { to: string; subject: string; html: string; text: string };

const outbox: Mail[] = [];
let transporter: Transporter | undefined;

export async function sendMail(mail: Mail): Promise<void> {
  const config = env();
  switch (config.MAIL_DRIVER) {
    case 'memory':
      outbox.push(mail);
      return;
    case 'file': {
      // Dùng cho E2E: Playwright đọc thư từ thư mục này.
      await mkdir(config.MAIL_OUTBOX_DIR, { recursive: true });
      const file = path.join(
        config.MAIL_OUTBOX_DIR,
        `${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
      );
      await writeFile(file, JSON.stringify(mail));
      return;
    }
    case 'console':
      console.info(`[mail] Tới: ${mail.to} | ${mail.subject}\n${mail.text}`);
      return;
    case 'smtp':
      transporter ??= nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465,
        auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      });
      await transporter.sendMail({ from: config.MAIL_FROM, ...mail });
  }
}

// Chỉ dùng trong test.
export function getOutbox(): readonly Mail[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}
