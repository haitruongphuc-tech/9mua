import type { Messages } from './vi';
import { common } from './ja/common';
import { live } from './ja/live';
import { auth } from './ja/auth';

export const ja: Messages = { ...common, ...live, ...auth };
