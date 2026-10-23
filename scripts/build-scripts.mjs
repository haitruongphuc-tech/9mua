// Đóng gói các lệnh CLI trong scripts/*.ts thành dist/scripts/*.mjs để chạy được trong image production
// (dùng chung code với app qua alias @/, không chép trùng logic).
import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/create-admin.ts'],
  outdir: 'dist/scripts',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Gói có mã native hoặc engine riêng: dùng bản trong node_modules của image.
  external: ['@prisma/client', '@node-rs/argon2', 'nodemailer'],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
