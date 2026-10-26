// Tạo / xoá dữ liệu mẫu để thử web trước khi mở cửa (src/server/demo-data.ts). Chạy trên VPS trong container
// worker (có ffmpeg để tạo video mẫu):
//   docker compose run --rm worker node dist/scripts/seed-demo.mjs            tạo
//   docker compose run --rm worker node dist/scripts/seed-demo.mjs --lam-lai  xoá dữ liệu mẫu cũ rồi tạo lại
//   docker compose run --rm worker node dist/scripts/seed-demo.mjs --xoa      xoá sạch trước khi mở cửa
// Có PEXELS_API_KEY trong .env thì dùng ảnh và video thật từ Pexels; không có thì dùng ảnh vẽ sẵn.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { removeDemoData, seedDemoData } from '@/server/demo-data';
import { createPexels } from '@/server/pexels';

const COLORS = ['0xf59e0b', '0x6366f1', '0xf472b6', '0x0ea5e9', '0xb45309', '0x22c55e'];

// Video dọc 8 giây: dải màu chuyển động + tiếng im lặng. Không có ffmpeg thì trả null (bỏ qua video).
async function gradientVideo(index: number): Promise<Buffer | null> {
  const dir = await mkdtemp(path.join(tmpdir(), '9mua-demo-'));
  const out = path.join(dir, 'demo.mp4');
  const c0 = COLORS[index % COLORS.length]!;
  const c1 = COLORS[(index + 3) % COLORS.length]!;
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `gradients=s=720x1280:c0=${c0}:c1=${c1}:speed=0.02:d=8:r=30`,
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
    '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out,
  ]; // prettier-ignore
  try {
    const code = await new Promise<number>((resolve) =>
      spawn('ffmpeg', args, { stdio: 'ignore' })
        .on('error', () => resolve(-1))
        .on('close', (c) => resolve(c ?? -1)),
    );
    return code === 0 ? await readFile(out) : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const { values } = parseArgs({ options: { xoa: { type: 'boolean' }, 'lam-lai': { type: 'boolean' } } });
  if (values.xoa || values['lam-lai']) {
    const r = await removeDemoData();
    if (r.users === 0) return console.log('Không có dữ liệu mẫu nào.');
    console.log(
      r.mode === 'deleted'
        ? `Đã xoá sạch: ${r.users} tài khoản, ${r.kiots} Kiot, ${r.products} sản phẩm, ${r.videos} video.`
        : `Dữ liệu mẫu đã có đơn hàng/tiền nên KHÔNG xoá được (sổ tiền chỉ thêm). Đã khoá ${r.users} tài khoản, ` +
            `${r.kiots} Kiot, ẩn ${r.products} sản phẩm và ${r.videos} video.`,
    );
    if (!values['lam-lai']) return;
  }

  const apiKey = process.env.PEXELS_API_KEY?.trim();
  const pexels = apiKey ? createPexels(apiKey) : null;
  console.log(pexels ? 'Lấy ảnh và video thật từ Pexels…' : 'Không có PEXELS_API_KEY: dùng ảnh vẽ sẵn.');
  const result = await seedDemoData({
    photo: pexels ? (query, shape) => pexels.photo(query, shape) : undefined,
    makeVideo: async (index, query) => (await pexels?.video(query)) ?? gradientVideo(index),
    log: (line) => console.log(line),
  });
  if (!result.ok) {
    console.error('Đã có dữ liệu mẫu. Muốn tạo lại thì chạy: seed-demo.mjs --lam-lai');
    process.exit(1);
  }
  const host = new URL(env().APP_URL).host;
  console.log(`
Xong: ${result.kiots} Kiot, ${result.products} sản phẩm, ${result.videos} video (worker xử lý video trong 1–2 phút).
Ảnh thật từ Pexels: ${result.realPhotos}/${result.products + result.kiots * 2}.
Xem thử: https://${host}/cho   https://mau-traicay.${host}   https://${host}/video
Tài khoản người bán mẫu (đăng nhập thử trang Kiot của tôi):
  Email:    ${result.login.email}
  Mật khẩu: ${result.login.password}
Trước khi mở cửa nhớ xoá: docker compose run --rm worker node dist/scripts/seed-demo.mjs --xoa`);
  if (pexels && result.realPhotos === 0)
    console.log('Không lấy được ảnh nào từ Pexels: kiểm tra PEXELS_API_KEY trong .env và mạng của VPS.');
  if (result.videos === 0)
    console.log('Không có ffmpeg nên chưa tạo video: hãy chạy lệnh trong container worker.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
