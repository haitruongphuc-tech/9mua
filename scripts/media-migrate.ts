// Chuyển dần video cũ từ ổ VPS lên kho video ngoài (SPEC-creator.md V5.1 mục 9). Chạy trên VPS sau khi điền khoá STORAGE_*:
//   docker compose run --rm app node dist/scripts/media-migrate.mjs            (mỗi lượt 50 video)
//   docker compose run --rm app node dist/scripts/media-migrate.mjs --limit 500
// Chạy lại được bao nhiêu lần cũng được: video đã chuyển thì bỏ qua. Chỉ xoá bản trên VPS khi mọi file của video đã lên
// kho ngoài và đọc lại khớp dung lượng.
import { parseArgs } from 'node:util';
import { db } from '@/lib/db';
import { migrateVideosToExternal } from '@/modules/creator';

async function main() {
  const { values } = parseArgs({ options: { limit: { type: 'string', default: '50' } } });
  const limit = Math.min(Math.max(Number(values.limit) || 50, 1), 5000);
  const result = await migrateVideosToExternal({ limit, log: (line) => console.info(line) });
  if (!result.ok) {
    console.error(
      'Chưa có kho video ngoài: điền STORAGE_S3_ENDPOINT, STORAGE_S3_BUCKET, STORAGE_S3_KEY, STORAGE_S3_SECRET,',
    );
    console.error('STORAGE_PUBLIC_URL trong .env rồi chạy lại.');
    process.exitCode = 1;
    return;
  }
  console.info(
    `Xong lượt này: chuyển ${result.moved} video, bỏ qua ${result.skipped}, còn ${result.remaining} video trên VPS.`,
  );
  if (result.remaining > 0) console.info('Chạy lại lệnh để chuyển tiếp.');
}

main()
  .catch((e) => {
    console.error('[media-migrate] lỗi:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
