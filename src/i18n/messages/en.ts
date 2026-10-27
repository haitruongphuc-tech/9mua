import type { Messages } from './vi';
import { common } from './en/common';
import { live } from './en/live';
import { auth } from './en/auth';

export const en: Messages = { ...common, ...live, ...auth };
