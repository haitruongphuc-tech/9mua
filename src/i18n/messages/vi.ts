// Từ điển gốc tiếng Việt (SPEC-i18n.md), ghép từ các nhóm trong thư mục vi/. Khoá phẳng "nhom.ten"; các
// thứ tiếng khác phải có đủ khoá như bản này. Nhóm "common." gửi xuống trình duyệt ở mọi trang.
import { common } from './vi/common';
import { live } from './vi/live';
import { auth } from './vi/auth';

export const vi = { ...common, ...live, ...auth } as const;

export type MessageKey = keyof typeof vi;
export type Messages = Record<MessageKey, string>;
