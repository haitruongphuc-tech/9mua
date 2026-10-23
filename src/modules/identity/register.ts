import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { normalizeIdentifier } from './identifier';
import { hashPassword } from './password';

export const registerInput = z.object({
  identifier: z.string().trim().min(1, 'Nhập số điện thoại hoặc email'),
  displayName: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(50, 'Tên tối đa 50 ký tự'),
  password: z.string().min(8, 'Mật khẩu cần ít nhất 8 ký tự').max(128, 'Mật khẩu tối đa 128 ký tự'),
});

type Field = keyof z.infer<typeof registerInput>;

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: 'IDENTIFIER_TAKEN' }
  | { ok: false; error: 'INVALID_INPUT'; fields: Partial<Record<Field, string>> };

export async function register(raw: unknown): Promise<RegisterResult> {
  const parsed = registerInput.safeParse(raw);
  const fields: Partial<Record<Field, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fields[issue.path[0] as Field] ??= issue.message;
  }
  const rawIdentifier = (raw as { identifier?: unknown } | null)?.identifier;
  const id = typeof rawIdentifier === 'string' ? normalizeIdentifier(rawIdentifier) : null;
  if (!id) fields.identifier ??= 'Số điện thoại hoặc email không hợp lệ';
  if (!parsed.success || !id) return { ok: false, error: 'INVALID_INPUT', fields };

  try {
    const user = await db.user.create({
      data: {
        ...id.where,
        displayName: parsed.data.displayName,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    // Ràng buộc unique của DB là chốt chặn cuối khi hai người đăng ký cùng lúc.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: 'IDENTIFIER_TAKEN' };
    }
    throw error;
  }
}
