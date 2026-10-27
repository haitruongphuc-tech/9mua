import type { Messages } from './vi';
import { auth } from './fr/auth';
import { common } from './fr/common';
import { feed } from './fr/feed';
import { live } from './fr/live';
import { me } from './fr/me';
import { notify } from './fr/notify';
import { post } from './fr/post';
import { profile } from './fr/profile';

export const fr: Messages = { ...auth, ...common, ...feed, ...live, ...me, ...notify, ...post, ...profile };
