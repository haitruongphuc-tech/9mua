import type { Messages } from './vi';
import { ai } from './en/ai';
import { auth } from './en/auth';
import { common } from './en/common';
import { feed } from './en/feed';
import { inbox } from './en/inbox';
import { legal } from './en/legal';
import { live } from './en/live';
import { market } from './en/market';
import { me } from './en/me';
import { notify } from './en/notify';
import { post } from './en/post';
import { profile } from './en/profile';
import { seller } from './en/seller';
import { shop } from './en/shop';

export const en: Messages = {
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
