import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Quét MỌI file của trang CEO: thêm route/action mới mà quên chặn quyền thì test này đỏ (SPEC-admin.md).
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ADMIN_FILES = [...walk('src/app/admin'), ...walk('src/app/api/admin')].filter((f) =>
  /\.(ts|tsx)$/.test(f),
);
// Bước nhập/cài 2 lớp: chỉ cần là admin (requireAdmin), vì chính nó là bước xác thực.
const TOTP_STEP = (f: string) => f.includes(`${path.sep}xac-thuc${path.sep}`);

describe('mọi route admin đều chặn quyền', () => {
  it('có quét được file', () => {
    expect(ADMIN_FILES.length).toBeGreaterThan(3);
  });

  it.each(ADMIN_FILES.filter((f) => /(page|route)\.tsx?$/.test(f)))('%s gọi hàm chặn quyền', (file) => {
    const src = readFileSync(file, 'utf8');
    const guard = TOTP_STEP(file)
      ? /await requireAdmin\(\)/
      : /await (requireAdminVerified|getVerifiedAdmin)\(\)/;
    expect(src).toMatch(guard);
  });

  it.each(ADMIN_FILES.filter((f) => readFileSync(f, 'utf8').startsWith("'use server'")))(
    '%s: mỗi Server Action tự chặn quyền',
    (file) => {
      const src = readFileSync(file, 'utf8');
      const actions = src.match(/^export async function \w+/gm) ?? [];
      const guard = TOTP_STEP(file) ? /await requireAdmin\(\)/g : /await requireAdminVerified\(\)/g;
      expect(actions.length).toBeGreaterThan(0);
      expect((src.match(guard) ?? []).length).toBeGreaterThanOrEqual(actions.length);
      // Mỗi hàm export phải có lời gọi chặn quyền ngay trong thân hàm.
      for (const chunk of src.split(/^export async function /m).slice(1))
        expect(chunk.split(/^}/m)[0]).toMatch(
          TOTP_STEP(file) ? /await requireAdmin\(\)/ : /await requireAdminVerified\(\)/,
        );
    },
  );
});
