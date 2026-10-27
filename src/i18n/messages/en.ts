import type { Messages } from './vi';
import { auth } from './en/auth';
import { common } from './en/common';
import { feed } from './en/feed';
import { live } from './en/live';
import { me } from './en/me';
import { notify } from './en/notify';
import { post } from './en/post';
import { profile } from './en/profile';

export const en: Messages = { ...auth, ...common, ...feed, ...live, ...me, ...notify, ...post, ...profile };
