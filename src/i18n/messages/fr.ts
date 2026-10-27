import type { Messages } from './vi';
import { common } from './fr/common';
import { live } from './fr/live';
import { auth } from './fr/auth';

export const fr: Messages = { ...common, ...live, ...auth };
