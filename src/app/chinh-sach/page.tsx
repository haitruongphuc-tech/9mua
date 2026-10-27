import { redirect } from 'next/navigation';

// Danh sách chính sách nằm ở trang Giới thiệu & Pháp lý.
export default function PoliciesIndex() {
  redirect('/gioi-thieu');
}
