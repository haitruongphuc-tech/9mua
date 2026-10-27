import type { Messages } from './vi';
import { auth } from './es/auth';
import { common } from './es/common';
import { feed } from './es/feed';
import { live } from './es/live';
import { notify } from './es/notify';
import { post } from './es/post';

export const es: Messages = { ...auth, ...common, ...feed, ...live, ...notify, ...post };
