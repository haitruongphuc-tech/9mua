import type { Messages } from './vi';
import { auth } from './ja/auth';
import { common } from './ja/common';
import { feed } from './ja/feed';
import { live } from './ja/live';
import { notify } from './ja/notify';
import { post } from './ja/post';

export const ja: Messages = { ...auth, ...common, ...feed, ...live, ...notify, ...post };
