import type { Messages } from './vi';
import { auth } from './ja/auth';
import { common } from './ja/common';
import { feed } from './ja/feed';
import { live } from './ja/live';
import { me } from './ja/me';
import { notify } from './ja/notify';
import { post } from './ja/post';
import { profile } from './ja/profile';

export const ja: Messages = { ...auth, ...common, ...feed, ...live, ...me, ...notify, ...post, ...profile };
