// Nội dung chuyển khoản qua PayOS: chỉ A-Z0-9, tối đa 9 ký tự (giới hạn tài khoản liên kết).
// Cần xác nhận lại với tài khoản PayOS thật ở Checkpoint D.
export const DESCRIPTION_MAX = 9;

export function normalizeDescription(input: string): string {
  const clean = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, DESCRIPTION_MAX);
  return clean || '9MUA';
}
