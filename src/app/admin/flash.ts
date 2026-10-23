import { redirect } from 'next/navigation';

// Quay về trang hàng chờ kèm thông báo kết quả.
export function back(
  path: string,
  result: { ok: true; message: string } | { ok: false; message: string },
): never {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${result.ok ? 'xong' : 'loi'}=${encodeURIComponent(result.message)}`);
}

export type FlashParams = Promise<{ xong?: string; loi?: string; [k: string]: string | undefined }>;
