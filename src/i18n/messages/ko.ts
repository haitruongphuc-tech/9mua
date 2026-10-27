import type { Messages } from './vi';
import { auth } from './ko/auth';
import { common } from './ko/common';
import { feed } from './ko/feed';
import { live } from './ko/live';
import { notify } from './ko/notify';
import { post } from './ko/post';

export const ko: Messages = { ...auth, ...common, ...feed, ...live, ...notify, ...post };
