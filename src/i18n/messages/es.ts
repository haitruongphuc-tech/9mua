import type { Messages } from './vi';
import { common } from './es/common';
import { live } from './es/live';
import { auth } from './es/auth';

export const es: Messages = { ...common, ...live, ...auth };
