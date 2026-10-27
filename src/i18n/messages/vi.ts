// Từ điển gốc tiếng Việt (SPEC-i18n.md), ghép từ các nhóm trong thư mục vi/. Khoá phẳng "nhom.ten"; các
// thứ tiếng khác phải có đủ khoá như bản này. Nhóm "common." gửi xuống trình duyệt ở mọi trang.
import { ai } from './vi/ai';
import { auth } from './vi/auth';
import { common } from './vi/common';
import { feed } from './vi/feed';
import { legal } from './vi/legal';
import { live } from './vi/live';
import { market } from './vi/market';
import { me } from './vi/me';
import { notify } from './vi/notify';
import { post } from './vi/post';
import { profile } from './vi/profile';
import { seller } from './vi/seller';
import { shop } from './vi/shop';

export const vi = {
  ...ai,
  ...auth,
  ...common,
  ...feed,
  ...legal,
  ...live,
  ...market,
  ...me,
  ...notify,
  ...post,
  ...profile,
  ...seller,
  ...shop,
} as const;

export type MessageKey = keyof typeof vi;
export type Messages = Record<MessageKey, string>;
