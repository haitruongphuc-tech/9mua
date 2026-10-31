import { Prisma } from '@prisma/client';
import { db } from './db';

// Tài khoản riêng tư (SPEC-identity.md V5.2): video / bài "public" của tài khoản riêng tư hiển thị như "followers" —
// không vào feed Dành cho bạn, hashtag, tìm kiếm, video hot, nhúng, tải về, Duet, Stitch. Dữ liệu không đổi; tắt riêng
// tư thì trở lại như cũ. Dùng chung cho creator và social nên nằm ở lib (như chặn).
export function notPrivateAuthor(userColumn: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`NOT EXISTS (SELECT 1 FROM "User" pa WHERE pa.id = ${userColumn} AND pa."isPrivate")`;
}

// Cho truy vấn Prisma không nối được bảng User: authorId: { notIn: await privateUserIds() }.
export async function privateUserIds(): Promise<string[]> {
  return (await db.user.findMany({ where: { isPrivate: true }, select: { id: true } })).map((u) => u.id);
}

export async function isPrivateAccount(userId: string): Promise<boolean> {
  return Boolean(
    (await db.user.findUnique({ where: { id: userId }, select: { isPrivate: true } }))?.isPrivate,
  );
}
