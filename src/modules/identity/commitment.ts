import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';

// Cam kết nội dung (SPEC-identity.md V5.6): phải đồng ý bản mới nhất trước khi đăng ký, tạo Kiot, phát live, đăng sản
// phẩm, đăng video/Story/bài viết. Máy chủ chặn bằng lỗi COMMITMENT_REQUIRED.
export type CommitmentText = { version: number; lines: string[] | null }; // lines null = 4 dòng mặc định (từ điển)

export async function currentCommitment(): Promise<CommitmentText> {
  const row = await db.commitmentVersion.findFirst({ orderBy: { version: 'desc' } });
  if (!row) return { version: 1, lines: null };
  return { version: row.version, lines: Array.isArray(row.lines) ? (row.lines as string[]) : null };
}

export async function hasCurrentCommitment(userId: string): Promise<boolean> {
  if (!(await isFeatureOn('commitment'))) return true;
  const { version } = await currentCommitment();
  return (await db.commitment.count({ where: { userId, version } })) > 0;
}

export async function acceptCommitment(
  userId: string,
  version: number,
  ip: string | null,
  userAgent: string | null,
): Promise<{ ok: true } | { ok: false; error: 'OUTDATED' }> {
  if (version !== (await currentCommitment()).version) return { ok: false, error: 'OUTDATED' };
  // Sổ chỉ thêm: bấm 2 lần thì dòng thứ hai bị bỏ qua nhờ khoá duy nhất (userId, version).
  await db.commitment.createMany({
    data: [
      {
        userId,
        version,
        acceptedAt: now(),
        ip: ip?.slice(0, 64) ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
      },
    ],
    skipDuplicates: true,
  });
  return { ok: true };
}

// CEO sửa chữ cam kết (/admin/noi-dung) thì tạo bản mới; mọi người được hỏi lại. Đúng 4 dòng, mỗi dòng ≤ 200 ký tự.
export async function publishCommitment(
  adminId: string | null,
  rawLines: string[],
): Promise<{ ok: true; version: number } | { ok: false; error: 'INVALID' }> {
  const lines = rawLines.map((l) => l.trim());
  if (lines.length !== 4 || lines.some((l) => !l || l.length > 200)) return { ok: false, error: 'INVALID' };
  const { version } = await currentCommitment();
  try {
    await db.commitmentVersion.create({
      data: { version: version + 1, lines, publishedAt: now(), publishedById: adminId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      return publishCommitment(adminId, rawLines);
    throw e;
  }
  return { ok: true, version: version + 1 };
}

// Trang tra cứu admin: bản nào, lúc nào, IP nào (người dùng thường không xem được).
export function commitmentRecords(userId: string) {
  return db.commitment.findMany({
    where: { userId },
    orderBy: { acceptedAt: 'desc' },
    select: { version: true, acceptedAt: true, ip: true, userAgent: true },
  });
}
