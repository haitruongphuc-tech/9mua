import type { Messages } from './vi';
import { ai } from './ko/ai';
import { auth } from './ko/auth';
import { common } from './ko/common';
import { feed } from './ko/feed';
import { live } from './ko/live';
import { market } from './ko/market';
import { me } from './ko/me';
import { notify } from './ko/notify';
import { post } from './ko/post';
import { profile } from './ko/profile';
import { seller } from './ko/seller';
import { shop } from './ko/shop';

export const ko: Messages = {
  ...ai,
  ...auth,
  ...common,
  ...feed,
  ...live,
  ...market,
  ...me,
  ...notify,
  ...post,
  ...profile,
  ...seller,
  ...shop,
};
