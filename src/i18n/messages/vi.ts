// Từ điển gốc tiếng Việt (SPEC-i18n.md), ghép từ các nhóm trong thư mục vi/. Khoá phẳng "nhom.ten"; các
// thứ tiếng khác phải có đủ khoá như bản này. Nhóm "common." gửi xuống trình duyệt ở mọi trang.
import { auth } from './vi/auth';
import { common } from './vi/common';
import { feed } from './vi/feed';
import { live } from './vi/live';
import { me } from './vi/me';
import { notify } from './vi/notify';
import { post } from './vi/post';
import { profile } from './vi/profile';

export const vi = { ...auth, ...common, ...feed, ...live, ...me, ...notify, ...post, ...profile } as const;

export type MessageKey = keyof typeof vi;
export type Messages = Record<MessageKey, string>;
