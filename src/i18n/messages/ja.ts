import type { Messages } from './vi';
import { ai } from './ja/ai';
import { auth } from './ja/auth';
import { common } from './ja/common';
import { feed } from './ja/feed';
import { legal } from './ja/legal';
import { live } from './ja/live';
import { market } from './ja/market';
import { me } from './ja/me';
import { notify } from './ja/notify';
import { post } from './ja/post';
import { profile } from './ja/profile';
import { seller } from './ja/seller';
import { shop } from './ja/shop';

export const ja: Messages = {
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
};
