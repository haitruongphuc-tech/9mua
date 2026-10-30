import { redirect } from 'next/navigation';
import { hasCurrentCommitment } from '@/modules/identity';

// Trang tạo Kiot, đăng sản phẩm, đăng video/Story, phát live: chưa đồng ý cam kết nội dung bản mới nhất thì sang bảng
// M5 rồi quay lại đúng trang này (SPEC-identity.md V5.6). Máy chủ vẫn chặn lần nữa ở từng thao tác.
export async function requireCommitment(userId: string, here: string): Promise<void> {
  if (!(await hasCurrentCommitment(userId))) redirect(`/cam-ket/dong-y?next=${encodeURIComponent(here)}`);
}
