// Đóng gói các lệnh CLI trong scripts/*.ts thành dist/scripts/*.mjs để chạy được trong image production
// (dùng chung code với app qua alias @/, không chép trùng logic).
import { build } from 'esbuild';

await build({
  entryPoints: [
    { in: 'scripts/create-admin.ts', out: 'create-admin' },
    { in: 'scripts/payos-confirm-webhook.ts', out: 'payos-confirm-webhook' },
    { in: 'worker/index.ts', out: 'worker' },
  ],
  outdir: 'dist/scripts',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Chỉ để ngoài các gói có mã native/engine riêng — bản standalone của Next chỉ giữ lại đúng những gói này
  // trong node_modules của image (gói JS thuần như nodemailer, @payos/node, qrcode đã bị Next gộp vào bản web,
  // nên script phải tự gộp, nếu không worker/CLI lỗi ERR_MODULE_NOT_FOUND trong Docker — phát hiện ở T36).
  external: ['@prisma/client', '@node-rs/argon2', 'sharp'],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
