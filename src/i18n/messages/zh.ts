import type { Messages } from './vi';
import { auth } from './zh/auth';
import { common } from './zh/common';
import { feed } from './zh/feed';
import { live } from './zh/live';
import { notify } from './zh/notify';
import { post } from './zh/post';

export const zh: Messages = { ...auth, ...common, ...feed, ...live, ...notify, ...post };
