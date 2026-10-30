import { Prisma } from '@prisma/client';

// Chuẩn hoá từ khoá tìm kiếm giống hàm search_norm của Postgres: bỏ dấu, đ → d, chữ thường, chỉ giữ chữ và số
// (nên ký tự đặc biệt của LIKE như % _ không lọt vào câu truy vấn).
export function normalizeSearchText(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

// Điều kiện "có đủ mọi từ" (không cần đúng thứ tự, không cần đứng liền nhau) trên một cột đã chuẩn hoá bằng
// search_norm. Tối đa 6 từ để câu truy vấn không phình to.
export function allWordsMatch(column: Prisma.Sql, q: string): Prisma.Sql {
  const words = q.split(' ').filter(Boolean).slice(0, 6);
  return Prisma.join(
    words.map((w) => Prisma.sql`${column} LIKE ${`%${w}%`}`),
    ' AND ',
  );
}
