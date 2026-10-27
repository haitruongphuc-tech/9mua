// Trang chính sách của sàn (SPEC-marketplace.md bổ sung 27/10). Nội dung là bản nháp do Claude viết theo cách 9MUA
// đang vận hành thật; CEO đọc duyệt trước khi deploy. Chữ trong {ngoặc} được thay bằng số liệu thật lúc hiển thị
// (thông tin công ty ở /admin/noi-dung, phí ở /admin/cai-dat) để trang luôn khớp với hệ thống.
export const POLICY_SLUGS = [
  'quy-che',
  'dieu-khoan',
  'bao-mat',
  'doi-tra',
  'khieu-nai',
  'van-chuyen',
  'thanh-toan',
] as const;

export type PolicySlug = (typeof POLICY_SLUGS)[number];

export type PolicyDoc = {
  title: string;
  summary: string;
  sections: { heading: string; paragraphs: string[] }[];
};

export type PolicySet = Record<PolicySlug, PolicyDoc>;

// Ngày CEO duyệt bản hiện hành (đổi khi sửa nội dung).
export const POLICY_UPDATED = new Date('2026-10-27T00:00:00+07:00');
