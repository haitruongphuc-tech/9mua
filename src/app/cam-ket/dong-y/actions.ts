'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/safe-next-path';
import { acceptCommitment, requireUser } from '@/modules/identity';

// Đồng ý cam kết nội dung (SPEC-identity.md V5.6): ghi sổ kèm IP (Nginx đặt X-Real-IP) và trình duyệt, rồi quay lại việc
// đang làm. Bản đã cũ (CEO vừa đổi chữ) thì tải lại trang để đọc bản mới.
export async function acceptCommitmentAction(version: number, next: string, form: FormData): Promise<void> {
  const user = await requireUser();
  const target = safeNextPath(next);
  if (form.getAll('line').length < 4) redirect(`/cam-ket/dong-y?next=${encodeURIComponent(target)}&thieu=1`);
  const h = await headers();
  const r = await acceptCommitment(user.id, version, h.get('x-real-ip'), h.get('user-agent'));
  if (!r.ok) redirect(`/cam-ket/dong-y?next=${encodeURIComponent(target)}`);
  redirect(target);
}
