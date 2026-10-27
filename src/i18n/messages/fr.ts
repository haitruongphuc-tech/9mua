import type { Messages } from './vi';
import { ai } from './fr/ai';
import { auth } from './fr/auth';
import { common } from './fr/common';
import { feed } from './fr/feed';
import { live } from './fr/live';
import { market } from './fr/market';
import { me } from './fr/me';
import { notify } from './fr/notify';
import { post } from './fr/post';
import { profile } from './fr/profile';
import { seller } from './fr/seller';
import { shop } from './fr/shop';

export const fr: Messages = {
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
