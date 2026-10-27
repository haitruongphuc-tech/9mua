import type { Messages } from './vi';
import { common } from './ko/common';
import { live } from './ko/live';
import { auth } from './ko/auth';

export const ko: Messages = { ...common, ...live, ...auth };
