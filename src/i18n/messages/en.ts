import type { Messages } from './vi';
import { auth } from './en/auth';
import { common } from './en/common';
import { feed } from './en/feed';
import { live } from './en/live';
import { notify } from './en/notify';
import { post } from './en/post';

export const en: Messages = { ...auth, ...common, ...feed, ...live, ...notify, ...post };
