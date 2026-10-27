import type { Messages } from './vi';
import { common } from './zh/common';
import { live } from './zh/live';
import { auth } from './zh/auth';

export const zh: Messages = { ...common, ...live, ...auth };
