import type { Messages } from './vi';
import { auth } from './es/auth';
import { common } from './es/common';
import { feed } from './es/feed';
import { live } from './es/live';
import { me } from './es/me';
import { notify } from './es/notify';
import { post } from './es/post';
import { profile } from './es/profile';

export const es: Messages = { ...auth, ...common, ...feed, ...live, ...me, ...notify, ...post, ...profile };
