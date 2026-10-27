import type { Messages } from './vi';
import { auth } from './ko/auth';
import { common } from './ko/common';
import { feed } from './ko/feed';
import { live } from './ko/live';
import { me } from './ko/me';
import { notify } from './ko/notify';
import { post } from './ko/post';
import { profile } from './ko/profile';

export const ko: Messages = { ...auth, ...common, ...feed, ...live, ...me, ...notify, ...post, ...profile };
