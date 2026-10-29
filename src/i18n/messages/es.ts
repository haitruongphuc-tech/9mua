import type { Messages } from './vi';
import { ai } from './es/ai';
import { auth } from './es/auth';
import { common } from './es/common';
import { feed } from './es/feed';
import { inbox } from './es/inbox';
import { legal } from './es/legal';
import { live } from './es/live';
import { market } from './es/market';
import { me } from './es/me';
import { notify } from './es/notify';
import { post } from './es/post';
import { profile } from './es/profile';
import { seller } from './es/seller';
import { shop } from './es/shop';

export const es: Messages = {
  ...ai,
  ...auth,
  ...common,
  ...feed,
  ...inbox,
  ...legal,
  ...live,
  ...market,
  ...me,
  ...notify,
  ...post,
  ...profile,
  ...seller,
  ...shop,
};
