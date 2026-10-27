import type { Messages } from './vi';
import { ai } from './zh/ai';
import { auth } from './zh/auth';
import { common } from './zh/common';
import { feed } from './zh/feed';
import { live } from './zh/live';
import { market } from './zh/market';
import { me } from './zh/me';
import { notify } from './zh/notify';
import { post } from './zh/post';
import { profile } from './zh/profile';
import { seller } from './zh/seller';
import { shop } from './zh/shop';

export const zh: Messages = {
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
