import { PrismaClient } from '@prisma/client';

// Truy cập DB trực tiếp từ E2E để giả lập các bước chưa có giao diện (vd. kích hoạt Kiot trước T16).
export const e2eDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL_E2E ?? 'postgresql://ninemua:ninemua@localhost:5432/ninemua_dev',
});

export async function activateKiot(slug: string, days = 365) {
  await e2eDb.kiot.update({
    where: { slug },
    data: { activeUntil: new Date(Date.now() + days * 86_400_000) },
  });
}
